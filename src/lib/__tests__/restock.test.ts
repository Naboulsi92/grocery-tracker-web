import type { SupabaseClient } from '@supabase/supabase-js';
import { restockItemQuantity, updateItemQuantity } from '@/lib/itemOperations';

// #252 : seam RPC des wrappers quantity — le flag p_clear_buy_quantity ne
// part que par restockItemQuantity, et le payload offline ne porte la clé
// clearBuyQuantity que pour un restock.

jest.mock('@/lib/history', () => ({
  logItemHistory: jest.fn(async () => undefined),
}));

jest.mock('@/lib/offlineQueue', () => ({
  enqueueAction: jest.fn(async () => 1),
}));

import { enqueueAction } from '@/lib/offlineQueue';

const mockEnqueueAction = enqueueAction as jest.MockedFunction<typeof enqueueAction>;

type FakeError = { message?: string; code?: string; status?: number } | null;

function makeClient(rpcResult: { error?: FakeError } = { error: null }) {
  const rpc = jest.fn(async () => rpcResult);
  const client = { rpc };
  return { client: client as unknown as SupabaseClient, rpc };
}

// rpc.mock.calls est typé [] (stub sans args déclarés) — élargi pour lire
// le nom de fonction et l'objet d'args réellement passés.
function rpcCall(rpc: jest.Mock, index = 0): [string, Record<string, unknown>] {
  return rpc.mock.calls[index] as unknown as [string, Record<string, unknown>];
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

const connectivityError = { message: 'fetch failed', status: 0, code: '' };
const businessError = { message: 'item not found', code: 'P0001', status: 404 };

beforeEach(() => {
  setOnLine(true);
  mockEnqueueAction.mockClear();
});

describe('#252 : RPC args des wrappers quantity', () => {
  it('updateItemQuantity envoie exactement les 2 args legacy (pas de clé de clear)', async () => {
    const { client, rpc } = makeClient();

    const result = await updateItemQuantity('i1', 2, client);

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith('adjust_item_quantity', { p_item_id: 'i1', p_delta: 2 });
    // toHaveBeenCalledWith ignore les clés undefined — vérifier l'absence réelle.
    expect(Object.keys(rpcCall(rpc)[1])).not.toContain('p_clear_buy_quantity');
  });

  it('restockItemQuantity ajoute p_clear_buy_quantity: true', async () => {
    const { client, rpc } = makeClient();

    const result = await restockItemQuantity('i1', 2, client);

    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith('adjust_item_quantity', {
      p_item_id: 'i1',
      p_delta: 2,
      p_clear_buy_quantity: true,
    });
  });
});

describe('#252 : payloads offline des wrappers quantity', () => {
  it('updateItemQuantity (connectivity) enqueue SANS la clé clearBuyQuantity', async () => {
    const { client } = makeClient({ error: connectivityError });

    const result = await updateItemQuantity('i1', 2, client);

    expect(result).toEqual({ error: null, queued: true });
    expect(mockEnqueueAction).toHaveBeenCalledTimes(1);
    const action = mockEnqueueAction.mock.calls[0][0];
    expect(action.type).toBe('updateQuantity');
    expect(action.payload).toEqual({ itemId: 'i1', delta: 2 });
    expect(Object.keys(action.payload)).not.toContain('clearBuyQuantity');
  });

  it('restockItemQuantity (connectivity) enqueue AVEC clearBuyQuantity: true', async () => {
    const { client } = makeClient({ error: connectivityError });

    const result = await restockItemQuantity('i1', 2, client);

    expect(result).toEqual({ error: null, queued: true });
    expect(mockEnqueueAction).toHaveBeenCalledTimes(1);
    const action = mockEnqueueAction.mock.calls[0][0];
    expect(action.type).toBe('updateQuantity');
    expect(action.payload).toEqual({ itemId: 'i1', delta: 2, clearBuyQuantity: true });
  });

  it('une erreur métier (404) ne va jamais en queue et remonte une erreur', async () => {
    const { client } = makeClient({ error: businessError });

    const result = await restockItemQuantity('i1', 2, client);

    expect(result.error).not.toBeNull();
    expect(result.queued).toBeUndefined();
    expect(mockEnqueueAction).not.toHaveBeenCalled();
  });
});
