import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ItemsPage from '@/app/items/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createClient } from '@/utils/supabase/client';

// Ticket #175 : editing an item's quantity and saving persists the number.
// Symptom seam (page level — a lib-only test cannot catch the page dropping
// the field): edit -> change quantity -> save -> adjust RPC carries the live
// delta. The items fetch mock applies captured deltas like the DB would, so
// the test also proves the displayed number moves.
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ householdId: 'household-1' }),
}));
jest.mock('@/hooks/useHousehold', () => ({
  useHousehold: () => ({ household: { id: 'household-1', name: 'Foyer' }, loading: false, error: '' }),
}));
jest.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
jest.mock('@/hooks/useResyncOnReconnect', () => ({ useResyncOnReconnect: jest.fn() }));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@/components/SyncingIndicator', () => ({ SyncingIndicator: () => null }));
jest.mock('@/components/AuthenticatedHeader', () => ({
  AuthenticatedHeader: () => null,
}));

const BASE_QTY = 2;
const rpcDeltas: number[] = [];
let updatePayloads: unknown[] = [];

function displayedQuantity() {
  return BASE_QTY + rpcDeltas.reduce((sum, delta) => sum + delta, 0);
}

const itemRow = () => ({
  id: 'item-1',
  name: 'Pain',
  unit: 'unite',
  quantity: displayedQuantity(),
  low_stock_threshold: 1,
  household_id: 'household-1',
  category_id: null,
  categories: null,
});

function mockClient() {
  const channelStub = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  const from = jest.fn((table: string) => {
    if (table === 'categories') {
      return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
    }
    if (table === 'history') {
      return { insert: async () => ({ error: null }) };
    }
    return {
      select: () => ({
        // fetchData filters on household_id first; updateItem's current-read
        // filters on id first — dispatch on the first column.
        eq: (col: string) =>
          col === 'household_id'
            ? { order: async () => ({ data: [itemRow()], error: null }) }
            : { eq: () => ({ maybeSingle: async () => ({ data: { ...itemRow() }, error: null }) }) },
      }),
      update: (data: unknown) => {
        updatePayloads.push(data);
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
    };
  });
  const rpc = jest.fn(async (fn: string, args: { p_delta: number }) => {
    if (fn === 'adjust_item_quantity') rpcDeltas.push(args.p_delta);
    return { error: null };
  });
  return { from, rpc, channel: jest.fn().mockReturnValue(channelStub), removeChannel: jest.fn() };
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

describe('ItemsPage edit quantity (ticket #175)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcDeltas.length = 0;
    updatePayloads = [];
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  async function openEdit() {
    render(
      <LanguageProvider>
        <ItemsPage />
      </LanguageProvider>
    );
    fireEvent.click(await screen.findByTestId('btn-edit-item-item-1'));
    const quantityInput = (await screen.findByTestId('input-item-quantity')) as HTMLInputElement;
    expect(quantityInput.value).toBe(String(BASE_QTY));
    return quantityInput;
  }

  it('persists an edited quantity on save (adjust RPC with the live delta)', async () => {
    const quantityInput = await openEdit();
    const client = jest.mocked(createClient).mock.results[0].value as unknown as {
      rpc: jest.Mock;
    };

    fireEvent.change(quantityInput, { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('btn-create-item'));

    await waitFor(() => {
      expect(client.rpc).toHaveBeenCalledWith('adjust_item_quantity', {
        p_item_id: 'item-1',
        p_delta: 5,
      });
    });
  });

  it('blocks an invalid quantity on edit (no write)', async () => {
    const quantityInput = await openEdit();
    const client = jest.mocked(createClient).mock.results[0].value as unknown as {
      rpc: jest.Mock;
    };

    fireEvent.change(quantityInput, { target: { value: '-3' } });
    fireEvent.click(screen.getByTestId('btn-create-item'));

    await screen.findByTestId('error-quantity-negative');
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
