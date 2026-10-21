import {
  BACKOFF_SCHEDULE,
  getBackoffDelay,
  MAX_PENDING,
  enqueueAction,
  startOfflineQueue,
  stopOfflineQueue,
} from '@/lib/offlineQueue';
import { restockItemQuantity, updateItemQuantity } from '@/lib/itemOperations';

// Note: jsdom does not ship a real IndexedDB, so the IDB-backed array methods
// (enqueueAction, getPendingActions, processQueue, ...) are exercised in the
// browser / e2e instead. Here we cover the pure queue helpers, plus the
// #252 replay dispatch with a minimal in-memory IDB stand-in below.

jest.mock('@/lib/itemOperations', () => ({
  createItem: jest.fn(async () => ({ error: null })),
  updateItem: jest.fn(async () => ({ error: null })),
  updateItemQuantity: jest.fn(async () => ({ error: null })),
  restockItemQuantity: jest.fn(async () => ({ error: null })),
  deleteItem: jest.fn(async () => ({ error: null })),
}));

const mockUpdateItemQuantity = updateItemQuantity as jest.MockedFunction<typeof updateItemQuantity>;
const mockRestockItemQuantity = restockItemQuantity as jest.MockedFunction<typeof restockItemQuantity>;

describe('offline queue backoff schedule', () => {
  it('defines the 1s → 30s exponential schedule', () => {
    expect([...BACKOFF_SCHEDULE]).toEqual([1000, 2000, 4000, 8000, 16000, 30000]);
  });

  it('uses the schedule for the first retry', () => {
    expect(getBackoffDelay(0)).toBe(1000);
    expect(getBackoffDelay(1)).toBe(2000);
    expect(getBackoffDelay(2)).toBe(4000);
    expect(getBackoffDelay(3)).toBe(8000);
    expect(getBackoffDelay(4)).toBe(16000);
  });

  it('clamps at 30s max once the schedule is exhausted', () => {
    expect(getBackoffDelay(5)).toBe(30000);
    expect(getBackoffDelay(100)).toBe(30000);
  });

  it('caps the pending queue to avoid unbounded accumulation', () => {
    expect(MAX_PENDING).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// #252 : replay dispatch 'updateQuantity'
//
// Minimal in-memory stand-in for the few IndexedDB calls offlineQueue makes
// (open/count/add/get/put/delete/clear/index.getAll), promise-microtask
// callbacks like the real API. Enough to drive the online-event replay loop.
// ---------------------------------------------------------------------------

type FakeRecord = { id: number; createdAt: number } & Record<string, unknown>;

interface FakeIdbRequest<T> {
  result?: T;
  error?: Error;
  onsuccess?: () => void;
  onerror?: () => void;
}

function fakeRequest<T>(run: () => T): FakeIdbRequest<T> {
  const request: FakeIdbRequest<T> = {};
  Promise.resolve().then(() => {
    request.result = run();
    request.onsuccess?.();
  });
  return request;
}

class FakeObjectStore {
  private records = new Map<number, FakeRecord>();
  private counter = 0;
  count() {
    return fakeRequest(() => this.records.size);
  }
  add(payload: Record<string, unknown>) {
    return fakeRequest(() => {
      const id = ++this.counter;
      this.records.set(id, { ...payload, id } as FakeRecord);
      return id;
    });
  }
  get(id: number) {
    return fakeRequest(() => this.records.get(id));
  }
  put(record: FakeRecord) {
    return fakeRequest(() => {
      this.records.set(record.id, record);
      return record.id;
    });
  }
  delete(id: number) {
    return fakeRequest(() => {
      this.records.delete(id);
    });
  }
  clear() {
    return fakeRequest(() => {
      this.records.clear();
    });
  }
  getAll() {
    return fakeRequest(() =>
      [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt),
    );
  }
  index() {
    return {
      getAll: () =>
        fakeRequest(() =>
          [...this.records.values()].sort((a, b) => a.createdAt - b.createdAt),
        ),
    };
  }
}

class FakeDatabase {
  private stores = new Map<string, FakeObjectStore>();
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  };
  createObjectStore(name: string) {
    this.stores.set(name, new FakeObjectStore());
    return { createIndex: () => undefined };
  }
  transaction(name: string) {
    return { objectStore: () => this.stores.get(name) };
  }
}

class FakeIDBFactory {
  private dbs = new Map<string, FakeDatabase>();
  open(name: string) {
    const isNew = !this.dbs.has(name);
    const db = this.dbs.get(name) ?? new FakeDatabase();
    this.dbs.set(name, db);
    const request: {
      result: FakeDatabase;
      onupgradeneeded?: () => void;
      onsuccess?: () => void;
      onerror?: () => void;
    } = { result: db };
    Promise.resolve().then(() => {
      if (isNew) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

// Drain the microtask chains the fake requests + processQueue run through.
async function flush() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("#252 : replay 'updateQuantity'", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: new FakeIDBFactory(),
    });
  });

  beforeEach(() => {
    setOnLine(true);
    mockUpdateItemQuantity.mockClear();
    mockRestockItemQuantity.mockClear();
  });

  afterAll(() => {
    stopOfflineQueue();
  });

  it('replays a payload with clearBuyQuantity through restockItemQuantity', async () => {
    startOfflineQueue();
    await flush();

    await enqueueAction({
      type: 'updateQuantity',
      payload: { itemId: 'i1', delta: 4, clearBuyQuantity: true },
      createdAt: Date.now(),
      retryCount: 0,
    });
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(mockRestockItemQuantity).toHaveBeenCalledWith('i1', 4);
    expect(mockUpdateItemQuantity).not.toHaveBeenCalled();
  });

  it('replays a legacy payload (no key) through updateItemQuantity', async () => {
    await enqueueAction({
      type: 'updateQuantity',
      payload: { itemId: 'i1', delta: 5 },
      createdAt: Date.now(),
      retryCount: 0,
    });
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(mockUpdateItemQuantity).toHaveBeenCalledWith('i1', 5);
    expect(mockRestockItemQuantity).not.toHaveBeenCalled();
  });
});