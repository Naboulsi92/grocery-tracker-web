import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ToBuyPage from '@/app/to-buy/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createClient } from '@/utils/supabase/client';
import { enqueueAction } from '@/lib/offlineQueue';

// #252 : contrat de la page /to-buy (intention d'achat) — badge « à acheter »,
// pré-remplissage du champ restock, et clear atomique de l'intention via le
// flag p_clear_buy_quantity sur le RPC adjust_item_quantity.
// #256 : le badge devient ÉDITABLE (badge interactif + chip fantôme + clear
// manuel) — écriture directe de buy_quantity via updateItem (colonne déjà
// grantée), micro-coupure = file d'attente type 'update'.

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
// #256 : la file hors-ligne est espionnée (payload 'update' avec buy_quantity).
jest.mock('@/lib/offlineQueue', () => ({ enqueueAction: jest.fn(async () => {}) }));

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

// updateItem relit la ligne courante (maybeSingle) puis PATCH (thenable
// terminal) ; la micro-coupure se simule via updateError status 0.
function mockClient(buyQuantity: number | null = null, opts: { updateError?: unknown } = {}) {
  const channelStub = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  const updates: Record<string, unknown>[] = [];
  const currentRow = { id: 'i1', name: 'Lait', unit: 'unite', quantity: 1, low_stock_threshold: 2 };
  const from = jest.fn((table: string) => {
    if (table === 'categories') {
      return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
    }
    if (table === 'history') {
      return { insert: async () => ({ error: null }) };
    }
    const selectChain: Record<string, unknown> = {
      eq: () => selectChain,
      order: async () => ({ data: [itemRow(buyQuantity)], error: null }),
      maybeSingle: async () => ({ data: currentRow, error: null }),
    };
    return {
      select: () => selectChain,
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        const chain: Record<string, unknown> = { eq: () => chain };
        return Object.assign(chain, {
          then: (resolve: (v: { error: unknown }) => unknown) =>
            Promise.resolve({ error: opts.updateError ?? null }).then(resolve),
        });
      },
    };
  });
  const rpc = jest.fn(async () => ({ error: null }));
  return Object.assign(
    {
      from,
      rpc,
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
      channel: jest.fn().mockReturnValue(channelStub),
      removeChannel: jest.fn(),
    },
    { updates },
  );
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

type TestClient = { rpc: jest.Mock; updates: Record<string, unknown>[] };

describe('#252 : to-buy (intention d\'achat)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  function client() {
    return jest.mocked(createClient).mock.results[0].value as unknown as TestClient;
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

describe('#256 : intention éditable sur /to-buy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  function client() {
    return jest.mocked(createClient).mock.results[0].value as unknown as TestClient;
  }

  it('le badge est un bouton qui ouvre l\'édition en ligne, pré-remplie', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    const badge = await screen.findByTestId('tobuy-buy-quantity-badge-lait');
    expect(badge.tagName).toBe('BUTTON');

    fireEvent.click(badge);
    const input = screen.getByTestId('tobuy-intent-input');
    expect(input).toHaveValue('3');
  });

  it('Entrée sur une nouvelle valeur écrit buy_quantity et met le badge à jour', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    fireEvent.click(await screen.findByTestId('tobuy-buy-quantity-badge-lait'));
    fireEvent.change(screen.getByTestId('tobuy-intent-input'), { target: { value: '5' } });
    fireEvent.keyDown(screen.getByTestId('tobuy-intent-input'), { key: 'Enter' });

    await waitFor(() => {
      expect(client().updates.some((patch) => patch.buy_quantity === 5)).toBe(true);
    });
    const badge = await screen.findByTestId('tobuy-buy-quantity-badge-lait');
    expect(badge.textContent).toContain('à acheter : 5 unite');
  });

  it('vider le champ puis Entrée = clear manuel (buy_quantity null, chip fantôme)', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    fireEvent.click(await screen.findByTestId('tobuy-buy-quantity-badge-lait'));
    fireEvent.change(screen.getByTestId('tobuy-intent-input'), { target: { value: '' } });
    fireEvent.keyDown(screen.getByTestId('tobuy-intent-input'), { key: 'Enter' });

    await waitFor(() => {
      expect(client().updates.some((patch) => patch.buy_quantity === null)).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('tobuy-buy-quantity-badge-lait')).toBeNull();
    });
    expect(screen.getByTestId('tobuy-buy-quantity-add-lait')).toBeDefined();
  });

  it('valeur invalide (0) : erreur en ligne, aucune écriture', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    fireEvent.click(await screen.findByTestId('tobuy-buy-quantity-badge-lait'));
    fireEvent.change(screen.getByTestId('tobuy-intent-input'), { target: { value: '0' } });
    fireEvent.keyDown(screen.getByTestId('tobuy-intent-input'), { key: 'Enter' });

    expect(screen.getByTestId('tobuy-intent-error')).toBeDefined();
    expect(client().updates).toHaveLength(0);
    // Le champ reste ouvert pour corriger.
    expect(screen.getByTestId('tobuy-intent-input')).toBeDefined();
  });

  it('chip fantôme sans intention : ouvrir, saisir 4, Entrée écrit buy_quantity 4', async () => {
    renderPage();

    const add = await screen.findByTestId('tobuy-buy-quantity-add-lait');
    fireEvent.click(add);

    const input = screen.getByTestId('tobuy-intent-input');
    expect(input).toHaveValue('');
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.keyDown(screen.getByTestId('tobuy-intent-input'), { key: 'Enter' });

    await waitFor(() => {
      expect(client().updates.some((patch) => patch.buy_quantity === 4)).toBe(true);
    });
    const badge = await screen.findByTestId('tobuy-buy-quantity-badge-lait');
    expect(badge.textContent).toContain('à acheter : 4 unite');
  });

  it('Annuler (✕) ferme sans écrire', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient(3) as never);
    renderPage();

    fireEvent.click(await screen.findByTestId('tobuy-buy-quantity-badge-lait'));
    fireEvent.change(screen.getByTestId('tobuy-intent-input'), { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('tobuy-intent-cancel'));

    expect(screen.queryByTestId('tobuy-intent-input')).toBeNull();
    expect(client().updates).toHaveLength(0);
    expect(screen.getByTestId('tobuy-buy-quantity-badge-lait').textContent).toContain('à acheter : 3 unite');
  });

  it('micro-coupure pendant l\'écriture : la file reçoit le payload update avec buy_quantity', async () => {
    jest
      .mocked(createClient)
      .mockReturnValue(mockClient(3, { updateError: { status: 0, message: '' } }) as never);
    renderPage();

    fireEvent.click(await screen.findByTestId('tobuy-buy-quantity-badge-lait'));
    fireEvent.change(screen.getByTestId('tobuy-intent-input'), { target: { value: '5' } });
    fireEvent.keyDown(screen.getByTestId('tobuy-intent-input'), { key: 'Enter' });

    await waitFor(() => {
      expect(enqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'update',
          payload: expect.objectContaining({ itemId: 'i1', householdId: 'household-1', buy_quantity: 5 }),
        }),
      );
    });
    // Miroir local malgré la coupure : le badge affiche déjà la valeur mise en file.
    const badge = await screen.findByTestId('tobuy-buy-quantity-badge-lait');
    expect(badge.textContent).toContain('à acheter : 5 unite');
  });
});
