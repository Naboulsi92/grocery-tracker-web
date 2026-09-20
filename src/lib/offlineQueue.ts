import { createItem, updateItem, updateItemQuantity, deleteItem } from './itemOperations';
import type { Unit } from '@/types/units';

export type OfflineAction = {
  id?: number;
  type: 'create' | 'update' | 'updateQuantity' | 'delete';
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
};

export type QueueSnapshot = {
  pendingCount: number;
  isSyncing: boolean;
  failedActions: OfflineAction[];
};

export const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000] as const;

// With the corrected trigger only genuine in-flight failures (micro-coupure,
// PRD §4.12) land in the queue. A small cap prevents unbounded accumulation if
// connectivity fails repeatedly while the user keeps acting.
export const MAX_PENDING = 3;

const DB_NAME = 'grocery-offline-queue';
const STORE_PENDING = 'actions';
const STORE_FAILED = 'failed';
const DB_VERSION = 2;
const MAX_RETRIES = BACKOFF_SCHEDULE.length;

// ---------------------------------------------------------------------------
// Promise-based IndexedDB wrapper
// ---------------------------------------------------------------------------

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FAILED)) {
        db.createObjectStore(STORE_FAILED, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

function dbTransaction(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(
    (db) => db.transaction(storeName, mode).objectStore(storeName),
  );
}

function dbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Queue persistence operations
// ---------------------------------------------------------------------------

export async function enqueueAction(action: OfflineAction): Promise<IDBValidKey> {
  const store = await dbTransaction(STORE_PENDING, 'readwrite');
  const count = await dbRequest<number>(store.count());
  if (count >= MAX_PENDING) {
    // Reject instead of silently dropping: the caller surfaces a visible error.
    throw new Error(`offline queue is full (max ${MAX_PENDING} pending actions)`);
  }
  const payload = { ...action };
  delete payload.id;
  const key = await dbRequest<IDBValidKey>(store.add(payload));
  // Surface the live pending count immediately (e.g. while offline).
  emitSnapshot({ ...snapshot, pendingCount: snapshot.pendingCount + 1 });
  return key;
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const store = await dbTransaction(STORE_PENDING, 'readonly');
  const index = store.index('createdAt');
  return dbRequest<OfflineAction[]>(index.getAll());
}

export async function getPendingCount(): Promise<number> {
  const store = await dbTransaction(STORE_PENDING, 'readonly');
  return dbRequest<number>(store.count());
}

export async function markProcessed(id: number): Promise<void> {
  const store = await dbTransaction(STORE_PENDING, 'readwrite');
  return dbRequest(store.delete(id));
}

export async function updateRetry(id: number, retryCount: number): Promise<void> {
  const store = await dbTransaction(STORE_PENDING, 'readwrite');
  const existing = await dbRequest<OfflineAction | undefined>(store.get(id));
  if (existing) {
    existing.retryCount = retryCount;
    await dbRequest(store.put(existing));
  }
}

export async function storeFailedAction(action: OfflineAction): Promise<void> {
  const store = await dbTransaction(STORE_FAILED, 'readwrite');
  const payload = { ...action };
  delete payload.id;
  await dbRequest(store.add(payload));
}

export async function getFailedActions(): Promise<OfflineAction[]> {
  const store = await dbTransaction(STORE_FAILED, 'readonly');
  return dbRequest<OfflineAction[]>(store.getAll());
}

export async function clearFailedActions(): Promise<void> {
  const store = await dbTransaction(STORE_FAILED, 'readwrite');
  return dbRequest(store.clear());
}

// ---------------------------------------------------------------------------
// Pub/sub — snapshot is only rebuilt when the queue state actually changes
// ---------------------------------------------------------------------------

type Listener = () => void;

let snapshot: QueueSnapshot = { pendingCount: 0, isSyncing: false, failedActions: [] };
const listeners = new Set<Listener>();

function emitSnapshot(s: QueueSnapshot) {
  snapshot = s;
  for (const fn of listeners) fn();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getSnapshot(): QueueSnapshot {
  return snapshot;
}

// ---------------------------------------------------------------------------
// Replay dispatch
//
// Replay-safety rationale:
//   create — payload is self-contained (householdId, name, unit, etc.). No DB
//            state needed; replay is safe regardless of other concurrent writes.
//
//   update — the original operation read the current item to decide on
//            unit-change clearing logic. At replay time we re-read the live
//            item so those decisions reflect the current world, not the stale
//            offline snapshot. If the item was deleted in the meantime, we
//            silently drop the stale action.
//
//   updateQuantity — pure delta RPC call. Inherently idempotent per
//                    (itemId, delta). Safe to replay.
//
//   delete — we fetch the item name at replay time for history logging.
//            If the item was already deleted, we silently drop the stale action.
// ---------------------------------------------------------------------------

async function replayAction(action: OfflineAction): Promise<void> {
  const p = action.payload;

  switch (action.type) {
    case 'create': {
      const result = await createItem(
        p.householdId as string,
        {
          name: p.name as string,
          quantity: p.quantity as number | undefined,
          unit: p.unit as Unit,
          category_id: (p.category_id as string | null) ?? null,
          low_stock_threshold: (p.low_stock_threshold as number | undefined) ?? undefined,
        },
      );
      if (result.error) throw result.error;
      break;
    }
    case 'update': {
      // Re-read the live item so unit-change decisions are correct.
      // If the item was deleted while offline, treat the action as stale.
      const { createClient } = await import('@/utils/supabase/client');
      const client = createClient();
      const { data: liveItem } = await client
        .from('items')
        .select('id')
        .eq('id', p.itemId as string)
        .eq('household_id', p.householdId as string)
        .maybeSingle();

      if (!liveItem) break;

      const result = await updateItem(
        p.itemId as string,
        p.householdId as string,
        {
          name: p.name as string | undefined,
          unit: p.unit as Unit | undefined,
          category_id: (p.category_id as string | null | undefined) as string | null | undefined,
          low_stock_threshold: p.low_stock_threshold as number | undefined,
        },
      );
      if (result.error) throw result.error;
      break;
    }
    case 'updateQuantity': {
      const result = await updateItemQuantity(
        p.itemId as string,
        p.delta as number,
      );
      if (result.error) throw result.error;
      break;
    }
    case 'delete': {
      // Re-check existence; if already deleted, remove stale action silently.
      const { createClient } = await import('@/utils/supabase/client');
      const client = createClient();
      const { data: liveItem } = await client
        .from('items')
        .select('id')
        .eq('id', p.itemId as string)
        .eq('household_id', p.householdId as string)
        .maybeSingle();

      if (!liveItem) break;

      const result = await deleteItem(
        p.itemId as string,
        p.householdId as string,
      );
      if (result.error) throw result.error;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Queue processor
// ---------------------------------------------------------------------------

let processing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let onlineHandler: (() => void) | null = null;

export function getBackoffDelay(retryCount: number): number {
  const index = Math.min(retryCount, BACKOFF_SCHEDULE.length - 1);
  return BACKOFF_SCHEDULE[index];
}

async function processQueue(): Promise<void> {
  if (processing || !navigator.onLine) return;
  processing = true;

  const startCount = await getPendingCount();
  emitSnapshot({ ...snapshot, isSyncing: true, pendingCount: startCount });

  let retryAfter: number = BACKOFF_SCHEDULE[0];

  try {
    const pending = await getPendingActions();

    for (const action of pending) {
      if (!navigator.onLine) break;

      try {
        await replayAction(action);
        if (action.id != null) await markProcessed(action.id);
      } catch {
        if (action.id == null) break;

        const nextRetry = (action.retryCount || 0) + 1;
        // Wait BACKOFF_SCHEDULE[failures-so-far] before the next attempt.
        retryAfter = getBackoffDelay(action.retryCount || 0);

        if (nextRetry >= MAX_RETRIES) {
          // Exhausted — move to the persisted failed store, remove from pending.
          await markProcessed(action.id);
          await storeFailedAction({ ...action, retryCount: nextRetry });
          emitSnapshot({
            ...snapshot,
            failedActions: [...snapshot.failedActions, { ...action, retryCount: nextRetry }],
          });
        } else {
          await updateRetry(action.id, nextRetry);
        }
        // Stop processing on first failure — retry later with backoff.
        break;
      }
    }
  } finally {
    processing = false;
    const count = await getPendingCount();
    emitSnapshot({ ...snapshot, pendingCount: count, isSyncing: false });
  }

  // Schedule retry for any remaining pending items.
  const remaining = await getPendingCount();
  if (remaining > 0 && navigator.onLine) {
    scheduleRetry(retryAfter);
  }
}

function scheduleRetry(delay: number): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void processQueue();
  }, delay);
}

// ---------------------------------------------------------------------------
// Start / stop
// ---------------------------------------------------------------------------

export function startOfflineQueue(): void {
  if (onlineHandler) return;

  onlineHandler = () => { void processQueue(); };
  window.addEventListener('online', onlineHandler);

  // Restore persisted failed actions (queue survives page refresh).
  void getFailedActions().then((failed) => {
    if (failed.length > 0 && snapshot.failedActions.length === 0) {
      emitSnapshot({ ...snapshot, failedActions: failed });
    }
  });

  if (navigator.onLine) void processQueue();
}

export function stopOfflineQueue(): void {
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  processing = false;
}

// ---------------------------------------------------------------------------
// Manual retry — moves failed actions back into the pending queue
// ---------------------------------------------------------------------------

export async function retryFailedActions(): Promise<void> {
  const failed = snapshot.failedActions;
  if (failed.length === 0) return;

  for (const action of failed) {
    await enqueueAction({
      type: action.type,
      payload: action.payload,
      createdAt: action.createdAt,
      retryCount: 0,
    });
  }

  await clearFailedActions();
  const count = await getPendingCount();
  emitSnapshot({ pendingCount: count, isSyncing: false, failedActions: [] });

  void processQueue();
}