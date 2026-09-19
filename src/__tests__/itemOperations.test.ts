import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createItem,
  deleteItem,
  isConnectivityError,
  updateItem,
  updateItemQuantity,
  type ItemOperationError,
} from '@/lib/itemOperations';

jest.mock('@/lib/offlineQueue', () => ({
  enqueueAction: jest.fn(async () => 1),
}));

import { enqueueAction } from '@/lib/offlineQueue';

const mockEnqueueAction = enqueueAction as jest.MockedFunction<typeof enqueueAction>;

type FakeError = { message?: string; code?: string; status?: number } | null;
type FakeResponses = {
  select?: { data?: unknown; error?: FakeError };
  insert?: { error?: FakeError };
  update?: { error?: FakeError };
  delete?: { error?: FakeError };
  rpc?: { error?: FakeError };
};

type Operation = () => Promise<ItemOperationError>;

// supabase-js query builders are sync-chainable (.eq(...).eq(...)) — only the
// terminal call (maybeSingle / the awaited call) may be async.
function makeSupabase(responses: FakeResponses = {}): SupabaseClient {
  const ok = { error: null };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      if (table === 'history') {
        return { insert: async () => ok };
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => responses.select ?? { data: null, error: null },
            }),
          }),
        }),
        insert: async () => responses.insert ?? ok,
        update: () => ({
          eq: () => ({ eq: async () => responses.update ?? ok }),
        }),
        delete: () => ({
          eq: () => ({ eq: async () => responses.delete ?? ok }),
        }),
      };
    },
    rpc: async () => responses.rpc ?? ok,
  };
  return client as unknown as SupabaseClient;
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function lastEnqueuedPayload() {
  expect(mockEnqueueAction).toHaveBeenCalledTimes(1);
  return mockEnqueueAction.mock.calls[0][0] as {
    type: string;
    payload: Record<string, unknown>;
    retryCount: number;
  };
}

const currentRow = {
  id: 'item-1',
  name: 'Pain',
  unit: 'unite',
  quantity: 2,
  low_stock_threshold: 1,
  template_id: null,
};

const connectivityError = { message: 'TypeError: Failed to fetch', status: 0, code: '' };
const businessError = {
  message: 'duplicate key value violates unique constraint',
  code: '23505',
  status: 409,
};
const serverError = { message: 'Internal Server Error', status: 500, code: '500' };

describe('isConnectivityError', () => {
  it('treats a failed fetch / no HTTP response as connectivity', () => {
    expect(isConnectivityError(connectivityError)).toBe(true);
    expect(isConnectivityError({ message: 'fetch failed', status: 0 })).toBe(true);
    expect(isConnectivityError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true);
  });

  it('never treats business or server errors as connectivity', () => {
    expect(isConnectivityError(businessError)).toBe(false);
    expect(isConnectivityError(serverError)).toBe(false);
    expect(isConnectivityError({ message: 'row-level security denies this operation', status: 403 })).toBe(false);
    expect(isConnectivityError(null)).toBe(false);
  });
});

describe('offline queue trigger — PRD §4.12 / §9', () => {
  beforeEach(() => {
    setOnLine(true);
    mockEnqueueAction.mockClear();
  });

  it('queues a create whose in-flight request failed with a connectivity error', async () => {
    const result = await createItem('home-1', { name: 'Pain', unit: 'unite' }, makeSupabase({ insert: { error: connectivityError } }));

    expect(result).toEqual({ error: null, queued: true });
    const enqueued = lastEnqueuedPayload();
    expect(enqueued.type).toBe('create');
    expect(enqueued.retryCount).toBe(0);
    expect(enqueued.payload).toMatchObject({ name: 'Pain', unit: 'unite', householdId: 'home-1', quantity: 1 });
  });

  it('queues an update whose current-read failed mid-flight', async () => {
    const result = await updateItem('item-1', 'home-1', { name: 'Pain complet' }, makeSupabase({ select: { data: null, error: connectivityError } }));

    expect(result).toEqual({ error: null, queued: true });
    const enqueued = lastEnqueuedPayload();
    expect(enqueued.type).toBe('update');
    expect(enqueued.payload).toMatchObject({ itemId: 'item-1', householdId: 'home-1', name: 'Pain complet' });
  });

  it('queues an update whose write failed mid-flight', async () => {
    const result = await updateItem('item-1', 'home-1', { name: 'Pain complet' }, makeSupabase({ select: { data: currentRow }, update: { error: connectivityError } }));

    expect(result).toEqual({ error: null, queued: true });
    const enqueued = lastEnqueuedPayload();
    expect(enqueued.type).toBe('update');
    expect(enqueued.payload).toMatchObject({ itemId: 'item-1', householdId: 'home-1', name: 'Pain complet' });
  });

  it('queues an updateQuantity whose RPC failed mid-flight', async () => {
    const result = await updateItemQuantity('item-1', 2, makeSupabase({ rpc: { error: connectivityError } }));

    expect(result).toEqual({ error: null, queued: true });
    const enqueued = lastEnqueuedPayload();
    expect(enqueued.type).toBe('updateQuantity');
    expect(enqueued.payload).toMatchObject({ itemId: 'item-1', delta: 2 });
  });

  it('queues a delete whose delete call failed mid-flight', async () => {
    const result = await deleteItem('item-1', 'home-1', makeSupabase({ delete: { error: connectivityError } }));

    expect(result).toEqual({ error: null, queued: true });
    const enqueued = lastEnqueuedPayload();
    expect(enqueued.type).toBe('delete');
    expect(enqueued.payload).toMatchObject({ itemId: 'item-1', householdId: 'home-1' });
  });

  it.each<[string, Operation]>([
    ['create', () => createItem('home-1', { name: 'Pain', unit: 'unite' }, makeSupabase({ insert: { error: businessError } }))],
    ['update', () => updateItem('item-1', 'home-1', { name: 'Pain' }, makeSupabase({ select: { data: currentRow }, update: { error: businessError } }))],
    ['updateQuantity', () => updateItemQuantity('item-1', 2, makeSupabase({ rpc: { error: businessError } }))],
    ['delete', () => deleteItem('item-1', 'home-1', makeSupabase({ delete: { error: businessError } }))],
  ])('does NOT queue a %s business error — surfaces it instead', async (_action, operate) => {
    const result = await operate();

    expect(result.queued).toBeUndefined();
    expect(result.error).not.toBeNull();
    expect(mockEnqueueAction).not.toHaveBeenCalled();
  });

  it.each<[string, Operation]>([
    ['create', () => createItem('home-1', { name: 'Pain', unit: 'unite' }, makeSupabase({ insert: { error: serverError } }))],
    ['update', () => updateItem('item-1', 'home-1', { name: 'Pain' }, makeSupabase({ select: { data: currentRow }, update: { error: serverError } }))],
    ['updateQuantity', () => updateItemQuantity('item-1', 2, makeSupabase({ rpc: { error: serverError } }))],
    ['delete', () => deleteItem('item-1', 'home-1', makeSupabase({ select: { data: currentRow }, delete: { error: serverError } }))],
  ])('does NOT queue a %s 5xx-with-response — surfaces it instead', async (_action, operate) => {
    const result = await operate();

    expect(result.queued).toBeUndefined();
    expect(result.error).not.toBeNull();
    expect(mockEnqueueAction).not.toHaveBeenCalled();
  });

  describe.each<[string, string, Operation]>([
    ['createItem', 'create', () => createItem('home-1', { name: 'Pain', unit: 'unite' })],
    ['updateItem', 'update', () => updateItem('item-1', 'home-1', { name: 'Pain' })],
    ['updateItemQuantity', 'updateQuantity', () => updateItemQuantity('item-1', 2)],
    ['deleteItem', 'delete', () => deleteItem('item-1', 'home-1')],
  ])('%s', (_label, action, operate) => {
    it(`attempted while already fully offline (${action}) returns an error and never queues`, async () => {
      setOnLine(false);

      const result = await operate();

      expect(result.error).not.toBeNull();
      expect(result.queued).toBeUndefined();
      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });
  });

  it('surfaces an error when the queue is unavailable instead of dropping the write silently', async () => {
    mockEnqueueAction.mockRejectedValueOnce(new Error('offline queue is full (max 3 pending actions)'));

    const result = await createItem('home-1', { name: 'Pain', unit: 'unite' }, makeSupabase({ insert: { error: connectivityError } }));

    expect(result.error).not.toBeNull();
    expect(result.queued).toBeUndefined();
    expect(mockEnqueueAction).toHaveBeenCalledTimes(1);
  });
});