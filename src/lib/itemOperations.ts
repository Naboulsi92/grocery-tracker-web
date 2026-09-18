import { createClient } from '@/utils/supabase/client';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logItemHistory } from './history';
import { enqueueAction, type OfflineAction } from './offlineQueue';

type Item = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
type DefaultItem = Database['public']['Tables']['default_items']['Row'];

export type { DefaultItem };

export function isItemPristine(item: Item, defaultItem?: DefaultItem | null): boolean {
  if (!item.default_item_id || !defaultItem || item.default_item_id !== defaultItem.id) return false;
  return (
    item.name.trim().toLowerCase() === defaultItem.name_fr.trim().toLowerCase() &&
    item.unit === defaultItem.unit &&
    item.low_stock_threshold === defaultItem.threshold
  );
}

// Per PRD §4.12 the queue is reserved for micro-coupures: a write that was
// already IN FLIGHT when the connection dropped. Only connectivity-grade
// failures may be queued; business errors (validation 4xx, server 5xx that
// returned a response) must surface to the user, never be silently queued.
//
// supabase-js wraps a failed fetch into { status: 0, statusText: '' } — no
// HTTP response ever arrived. Business errors always carry a real status. The
// message/details probes cover fetch-level rejections reported by other paths.
export function isConnectivityError(
  error: { message?: string; code?: string; status?: number; details?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.status === 0) return true;
  const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return /failed to fetch|fetch failed|load failed|networkerror|network request failed|getaddrinfo|enotfound|econnreset|err_network/i.test(
    message,
  );
}

export type ItemOperationError = {
  error: Error | null;
  queued?: boolean;
};

function logItemOperationError(
  action: 'create' | 'update' | 'updateQuantity' | 'delete',
  error: { code?: string } | null | undefined
) {
  console.warn('client_operation_failed', {
    area: 'item',
    action,
    code: error?.code ?? 'unknown',
  });
}

// Attempted while already fully offline: never queued (PRD §9 — offline
// writing is out of scope; controls are disabled anyway once the page gates on
// useOnlineStatus). Surface a plain failure instead.
function offlineError(action: 'create' | 'update' | 'updateQuantity' | 'delete'): ItemOperationError {
  return { error: new Error(itemActionError(action, { message: 'offline' })) };
}

// A connectivity failure hit an in-flight write: park it in the pending queue
// (PRD §4.12 micro-coupure). If the queue itself is unavailable or full (cap in
// offlineQueue.ts), fall back to a visible error instead of dropping the write.
async function enqueueOrFail(
  action: OfflineAction,
  actionKind: 'create' | 'update' | 'updateQuantity' | 'delete',
): Promise<ItemOperationError> {
  try {
    await enqueueAction(action);
    return { error: null, queued: true };
  } catch {
    logItemOperationError(actionKind, { code: 'enqueue_failed' });
    return { error: new Error(itemActionError(actionKind, { message: 'queue unavailable' })) };
  }
}

export async function createItem(
  householdId: string,
  data: {
    name: string;
    quantity?: number;
    unit: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  },
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) return offlineError('create');

  const client = supabase ?? createClient();

  const itemData: ItemInsert = {
    household_id: householdId,
    name: data.name,
    quantity: data.quantity ?? 1,
    unit: data.unit,
    category_id: data.category_id ?? null,
    low_stock_threshold: data.low_stock_threshold ?? 1,
  };

  const { error } = await client.from('items').insert(itemData);

  if (error) {
    logItemOperationError('create', error);
    if (isConnectivityError(error)) {
      return enqueueOrFail(
        {
          type: 'create',
          payload: {
            householdId,
            name: data.name,
            quantity: data.quantity ?? 1,
            unit: data.unit,
            category_id: data.category_id ?? null,
            low_stock_threshold: data.low_stock_threshold ?? 1,
          },
          createdAt: Date.now(),
          retryCount: 0,
        },
        'create',
      );
    }
    return { error: new Error(itemActionError('create', error)) };
  }

  return { error: null };
}

export async function updateItem(
  itemId: string,
  householdId: string,
  data: {
    name?: string;
    unit?: string;
    category_id?: string | null;
    low_stock_threshold?: number;
  },
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) return offlineError('update');

  const client = supabase ?? createClient();

  const enqueueUpdate = () =>
    enqueueOrFail(
      {
        type: 'update',
        payload: { itemId, householdId, ...data },
        createdAt: Date.now(),
        retryCount: 0,
      },
      'update',
    );

  const { data: current, error: currentError } = await client
    .from('items')
    .select('id, name, unit, quantity, low_stock_threshold, default_item_id')
    .eq('id', itemId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (currentError) {
    logItemOperationError('update', currentError);
    if (isConnectivityError(currentError)) return enqueueUpdate();
    return { error: new Error(itemActionError('update', currentError)) };
  }

  if (!current) {
    return { error: new Error(itemActionError('update', { message: 'item not found' })) };
  }

  const unitChanged = data.unit !== undefined && data.unit !== current.unit;

  const updateData: ItemUpdate = {
    name: data.name,
    unit: data.unit,
    category_id: data.category_id,
    low_stock_threshold: data.low_stock_threshold,
  };

  // Unit change clears the low-stock threshold (user must re-enter). The DB column is
  // non-nullable, so 1 is the "cleared" sentinel. The default-origin marker is preserved:
  // divergence from the linked default IS the fork.
  if (unitChanged) {
    updateData.low_stock_threshold = 1;
  }

  const { error } = await client
    .from('items')
    .update(updateData)
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    logItemOperationError('update', error);
    if (isConnectivityError(error)) return enqueueUpdate();
    return { error: new Error(itemActionError('update', error)) };
  }

  // Unit change clears the quantity too; clients have no direct UPDATE grant on quantity,
  // so use the existing adjust RPC (delta = -current, clamped to 0). Not history-logged.
  if (unitChanged && current.quantity > 0) {
    const { error: quantityError } = await client.rpc('adjust_item_quantity', {
      p_item_id: itemId,
      p_delta: -current.quantity,
    });
    if (quantityError) {
      logItemOperationError('update', quantityError);
      if (isConnectivityError(quantityError)) return enqueueUpdate();
      return { error: new Error(itemActionError('update', quantityError)) };
    }
  }

  const itemName =
    data.name !== undefined && data.name.trim() !== current.name
      ? data.name.trim()
      : current.name;
  await logItemHistory(householdId, 'modification', itemName, client);

  return { error: null };
}

export async function updateItemQuantity(
  itemId: string,
  quantity: number,
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) return offlineError('updateQuantity');

  const client = supabase ?? createClient();

  const { error } = await client.rpc('adjust_item_quantity', {
    p_item_id: itemId,
    p_delta: quantity,
  });

  if (error) {
    logItemOperationError('updateQuantity', error);
    if (isConnectivityError(error)) {
      return enqueueOrFail(
        {
          type: 'updateQuantity',
          payload: { itemId, delta: quantity },
          createdAt: Date.now(),
          retryCount: 0,
        },
        'updateQuantity',
      );
    }
    return { error: new Error(itemActionError('updateQuantity', error)) };
  }

  return { error: null };
}

export async function deleteItem(
  itemId: string,
  householdId: string,
  supabase?: SupabaseClient
): Promise<ItemOperationError> {
  if (!navigator.onLine) return offlineError('delete');

  const client = supabase ?? createClient();

  const enqueueDelete = () =>
    enqueueOrFail(
      {
        type: 'delete',
        payload: { itemId, householdId },
        createdAt: Date.now(),
        retryCount: 0,
      },
      'delete',
    );

  const { data: itemToDelete, error: selectError } = await client
    .from('items')
    .select('name')
    .eq('id', itemId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (selectError) {
    logItemOperationError('delete', selectError);
    if (isConnectivityError(selectError)) return enqueueDelete();
    return { error: new Error(itemActionError('delete', selectError)) };
  }
  const itemName = itemToDelete?.name;

  const { error } = await client
    .from('items')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) {
    logItemOperationError('delete', error);
    if (isConnectivityError(error)) return enqueueDelete();
    return { error: new Error(itemActionError('delete', error)) };
  }

  if (itemName) {
    await logItemHistory(householdId, 'suppression', itemName, client);
  }

  return { error: null };
}

function itemActionError(
  action: 'create' | 'update' | 'updateQuantity' | 'delete',
  error: { message?: string; code?: string } | null | undefined
): string {
  if (action === 'update' && error?.message?.includes('row-level security')) {
    return 'errors.item.update_denied';
  }
  if (action === 'delete' && error?.message?.includes('row-level security')) {
    return 'errors.item.delete_denied';
  }

  const fallback = {
    create: 'errors.item.create_failed',
    update: 'errors.item.update_failed',
    updateQuantity: 'errors.item.quantity_failed',
    delete: 'errors.item.delete_failed',
  } as const;

  return fallback[action];
}