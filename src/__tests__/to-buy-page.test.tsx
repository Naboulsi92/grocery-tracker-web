import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ToBuyPage from '@/app/to-buy/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createClient } from '@/utils/supabase/client';

// #252 : contrat de la page /to-buy (intention d'achat) — badge « à acheter »,
// pré-remplissage du champ restock, et clear atomique de l'intention via le
// flag p_clear_buy_quantity sur le RPC adjust_item_quantity.

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ householdId: 'household-1' }),
}));
jest.mock('@/hooks/useHousehold', () => ({
  useHousehold: () => ({
    household: { id: 'household-1', name: 'Foyer' },
    members: [{ user_id: 'u2', role: 'member' }],
    loading: false,
    error: '',
  }),
}));
jest.mock('@/hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
jest.mock('@/hooks/useResyncOnReconnect', () => ({ useResyncOnReconnect: jest.fn() }));
jest.mock('@/hooks/useAppBadgeSync', () => ({ useAppBadgeSync: jest.fn() }));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('@/components/SyncingIndicator', () => ({ SyncingIndicator: () => null }));
jest.mock('@/components/AuthenticatedHeader', () => ({
  AuthenticatedHeader: () => null,
}));

function itemRow(buyQuantity: number | null) {
  return {
    id: 'i1',
    household_id: 'household-1',
    category_id: null,
    name: 'Lait',
    quantity: 1,
    unit: 'unite',
    low_stock_threshold: 2,
    already_notified: false,
    template_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_modified_at: null,
    last_modified_by: null,
    buy_quantity: buyQuantity,
  };
}

// Chaînes réelles de la page : items select().eq(household_id).order(name) ;
// categories select().eq(household_id) SANS order (attendu directement).
function mockClient(buyQuantity: number | null = null) {
  const channelStub = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  const from = jest.fn((table: string) => {
    if (table === 'categories') {
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    }
    if (table === 'history') {
      return { insert: async () => ({ error: null }) };
    }
    return {
      select: () => ({
        eq: () => ({ order: async () => ({ data: [itemRow(buyQuantity)], error: null }) }),
      }),
    };
  });
  const rpc = jest.fn(async () => ({ error: null }));
  return {
    from,
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    channel: jest.fn().mockReturnValue(channelStub),
    removeChannel: jest.fn(),
  };
}

function setOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });
}

function renderPage() {
  render(
    <LanguageProvider>
      <ToBuyPage />
    </LanguageProvider>,
  );
}

describe('#252 : to-buy (intention d\'achat)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  function client() {
    return jest.mocked(createClient).mock.results[0].value as unknown as { rpc: jest.Mock };
  }

  it('le badge d\'intention apparaît avec la quantité à acheter', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    const badge = await screen.findByTestId('tobuy-buy-quantity-badge-lait');
    expect(badge.textContent).toContain('à acheter : 3 unite');
  });

  it('pas de badge sans intention', async () => {
    renderPage();
    // La rangée est rendue (l'article est en rupture) — le badge, lui, absent.
    await screen.findByTestId('tobuy-item-row-lait');
    expect(screen.queryByTestId('tobuy-buy-quantity-badge-lait')).toBeNull();
  });

  it('le champ restock est pré-rempli avec l\'intention', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    const input = await screen.findByTestId('tobuy-quantity-input');
    expect(input).toHaveValue(3);
  });

  it('un restock validé passe le flag de clear au RPC', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    const input = await screen.findByTestId('tobuy-quantity-input');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.click(screen.getByTestId('tobuy-check-button'));

    await waitFor(() => {
      expect(client().rpc).toHaveBeenCalledWith('adjust_item_quantity', {
        p_item_id: 'i1',
        p_delta: 2,
        p_clear_buy_quantity: true,
      });
    });
  });
});
