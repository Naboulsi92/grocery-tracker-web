import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  buy_quantity: null,
  household_id: 'household-1',
  category_id: null,
  categories: null,
});

function mockClient(options: {
  // Ticket #251 MS3 : le multi-article (instance unique) et le réseau en
  // suspens (Escape pendant mutating === 'form') nécessitent de paramétrer
  // les listes retournées et le moment où l'UPDATE se résout. Sans options,
  // comportement strictement identique à la suite #175 existante.
  items?: () => Record<string, unknown>[];
  categories?: () => Record<string, unknown>[];
  pendingUpdate?: boolean;
} = {}) {
  const listItems = options.items ?? (() => [itemRow()]);
  const listCategories = options.categories ?? (() => []);
  // Résolveur de la promesse update().eq().eq() quand pendingUpdate : le test
  // le déclenche tardivement pour simuler la fin de la sauvegarde.
  const updateGate: { resolve: ((value: { error: null }) => void) | null } = { resolve: null };
  const channelStub = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  const from = jest.fn((table: string) => {
    if (table === 'categories') {
      return { select: () => ({ eq: () => ({ order: async () => ({ data: listCategories(), error: null }) }) }) };
    }
    if (table === 'history') {
      return { insert: async () => ({ error: null }) };
    }
    return {
      select: () => ({
        // fetchData filters on household_id first; updateItem's current-read
        // and deleteItem's name-read filter on id first — dispatch on the
        // first column.
        eq: (col: string) =>
          col === 'household_id'
            ? { order: async () => ({ data: listItems(), error: null }) }
            : { eq: () => ({ maybeSingle: async () => ({ data: { ...listItems()[0] }, error: null }) }) },
      }),
      update: (data: unknown) => {
        updatePayloads.push(data);
        if (options.pendingUpdate) {
          return {
            eq: () => ({
              eq: () =>
                new Promise<{ error: null }>((resolve) => {
                  updateGate.resolve = resolve;
                }),
            }),
          };
        }
        return { eq: () => ({ eq: async () => ({ error: null }) }) };
      },
      // deleteItem (flow deleteTarget → confirmation) : select('name') puis
      // delete().eq().eq() — la suppression locale est faite par la page.
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    };
  });
  const rpc = jest.fn(async (fn: string, args: { p_delta: number }) => {
    if (fn === 'adjust_item_quantity') rpcDeltas.push(args.p_delta);
    return { error: null };
  });
  // logItemHistory (updateItem/deleteItem) lit l'utilisateur avant l'insert
  // history — sans auth.getUser le flow complet échoue après le réseau.
  const auth = { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) };
  return { from, rpc, auth, channel: jest.fn().mockReturnValue(channelStub), removeChannel: jest.fn(), updateGate };
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

  it('requires re-entering the threshold after a unit change on edit (no NULL write, #222)', async () => {
    await openEdit();
    const client = jest.mocked(createClient).mock.results[0].value as unknown as {
      rpc: jest.Mock;
    };

    // Unit change clears quantity AND threshold (PRD §4.4).
    fireEvent.change(screen.getByTestId('input-item-unit'), { target: { value: 'kg' } });
    expect((screen.getByTestId('input-item-threshold') as HTMLInputElement).value).toBe('');

    // Saving with the threshold still empty must be rejected — a NULL threshold
    // is the "black hole" (never low-stock, never reminded), so re-entry is
    // mandatory on edit, not just on create. No write may happen.
    fireEvent.click(screen.getByTestId('btn-create-item'));

    await screen.findByTestId('error-threshold-required');
    expect(updatePayloads).toHaveLength(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('renders the prototype-Actuel row (stock sub-line, detached circular stepper)', async () => {
    render(
      <LanguageProvider>
        <ItemsPage />
      </LanguageProvider>
    );
    expect(await screen.findByText('2 unite · seuil 1')).toBeVisible();
    expect(screen.getByTestId('btn-quantity-increment-item-1')).toHaveClass('qty-btn-plus');
  });
});

// Ticket #251 MS3 : contrat de la carte d'édition inline (toggle ✎, instance
// unique, focus Nom à l'ouverture, restitution du focus au ✎, Escape — dont
// le blocage pendant mutating === 'form' —, garde « article disparu », et
// non-régression du mode création en haut de page).
describe('ItemsPage inline edit card (ticket #251 MS3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcDeltas.length = 0;
    updatePayloads = [];
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  async function renderPage() {
    render(
      <LanguageProvider>
        <ItemsPage />
      </LanguageProvider>
    );
    return screen.findByTestId('btn-edit-item-item-1');
  }

  function pressEscape() {
    fireEvent.keyDown(document, { key: 'Escape' });
  }

  it('opens the card inline under the edited row and closes it on a second ✎ click (toggle, no reopen)', async () => {
    const editButton = await renderPage();
    fireEvent.click(editButton);

    const nameInput = await screen.findByTestId('input-item-name');
    // Carte frère DOM direct immédiat de la rangée éditée (groupe flex-column).
    const row = screen.getByTestId('item-row-pain');
    expect(nameInput.closest('.card')).toBe(row.nextElementSibling);
    // C'est le mode édition, pas création : titre d'édition, panneau de
    // création du haut fermé (« Nouvel article » a disparu, un seul formulaire).
    expect(screen.getByRole('heading', { name: "Modifier l'article" })).toBeInTheDocument();
    expect(screen.queryByText('Nouvel article')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('input-item-name')).toHaveLength(1);

    // Re-clic sur le même ✎ → la carte se referme (voie « Annuler »).
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument();
    // Aucune réouverture : le bouton de création revient, pas de formulaire.
    await screen.findByTestId('btn-new-item');
    expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument();
  });

  it('keeps exactly one card instance and prefills it with the second item when ✎ moves to another row', async () => {
    const milkyRow = {
      id: 'item-2',
      name: 'Lait',
      unit: 'l',
      quantity: 4,
      low_stock_threshold: 2,
      household_id: 'household-1',
      category_id: 'cat-1',
      categories: null,
    };
    const categoryRow = {
      id: 'cat-1',
      household_id: 'household-1',
      name: 'Crèmerie',
      is_default: false,
      created_at: '2026-01-01T00:00:00Z',
    };
    jest
      .mocked(createClient)
      .mockReturnValue(
        mockClient({ items: () => [itemRow(), milkyRow], categories: () => [categoryRow] }) as never,
      );
    await renderPage();

    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    await screen.findByTestId('input-item-name');

    // Le ✎ d'un autre article DÉPLACE la carte (jamais deux instances).
    fireEvent.click(screen.getByTestId('btn-edit-item-item-2'));
    const nameInputs = screen.getAllByTestId('input-item-name');
    expect(nameInputs).toHaveLength(1);
    expect(nameInputs[0]).toHaveValue('Lait');
    expect(screen.getByTestId('input-item-category')).toHaveValue('cat-1');
    expect(screen.getByTestId('input-item-quantity')).toHaveValue(4);
    expect(screen.getByTestId('input-item-threshold')).toHaveValue(2);
    // La carte appartient bien à la seconde rangée (frère immédiat).
    expect(nameInputs[0].closest('.card')).toBe(screen.getByTestId('item-row-lait').nextElementSibling);
  });

  it('moves focus to the Name field when the card opens', async () => {
    const editButton = await renderPage();
    fireEvent.click(editButton);

    const nameInput = await screen.findByTestId('input-item-name');
    await waitFor(() => expect(document.activeElement).toBe(nameInput));
  });

  it('returns focus to the row ✎ when the card closes via Annuler', async () => {
    const editButton = await renderPage();
    fireEvent.click(editButton);
    await screen.findByTestId('input-item-name');

    fireEvent.click(screen.getByTestId('btn-cancel-item'));

    expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('btn-edit-item-item-1'));
    expect(editButton).toHaveFocus();
  });

  it('closes the card on Escape and returns focus to the row ✎', async () => {
    const editButton = await renderPage();
    fireEvent.click(editButton);
    await screen.findByTestId('input-item-name');

    pressEscape();

    expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByTestId('btn-edit-item-item-1'));
    expect(editButton).toHaveFocus();
  });

  it('keeps the card open on Escape while the save is in flight, then closes once the update resolves', async () => {
    jest.mocked(createClient).mockReturnValue(mockClient({ pendingUpdate: true }) as never);
    const editButton = await renderPage();
    const client = jest.mocked(createClient).mock.results[0].value as unknown as {
      updateGate: { resolve: ((value: { error: null }) => void) | null };
    };
    fireEvent.click(editButton);
    await screen.findByTestId('input-item-name');

    // Sauvegarde déclenchée puis en suspens : update().eq().eq() non résolue,
    // mutating === 'form'.
    fireEvent.click(screen.getByTestId('btn-create-item'));
    await waitFor(() => expect(client.updateGate.resolve).not.toBeNull());

    pressEscape();

    // Escape est ignoré pendant la mutation : la carte reste ouverte, le
    // formulaire n'est ni effacé ni doublé d'un panneau de création.
    const nameInput = screen.getByTestId('input-item-name');
    expect(nameInput).toHaveValue('Pain');
    expect(screen.getAllByTestId('input-item-name')).toHaveLength(1);

    // Résolution tardive : l'UPDATE est bien parti, le flow termine et ferme.
    await act(async () => {
      client.updateGate.resolve?.({ error: null });
    });
    await waitFor(() => expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument());
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0]).toMatchObject({ name: 'Pain' });
  });

  it('closes the card (resetForm) when the edited item is deleted from the list', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    await screen.findByTestId('input-item-name');

    // Flow deleteTarget → dialog de confirmation sur le même article.
    fireEvent.click(screen.getByTestId('btn-delete-item-item-1'));
    fireEvent.click(await screen.findByTestId('item-delete-confirm'));

    // L'article disparaît de la liste → garde-fou : la carte se referme par
    // resetForm ; le panneau de création du haut reste fermé.
    await waitFor(() => expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument());
    expect(screen.queryByTestId('btn-create-item')).not.toBeInTheDocument();
    // Liste vidée → état vide avec le bouton de création (pas de formulaire ouvert).
    expect(await screen.findByTestId('btn-new-item')).toBeInTheDocument();
  });

  it('does not close the top create panel on Escape (create mode unchanged, cancel only)', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-new-item'));

    // Mode création : panneau du haut, titre création + btn-create-item.
    expect(await screen.findByTestId('btn-create-item')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nouvel article' })).toBeInTheDocument();
    // Aucun mode édition en cours : le champ est dans le panneau du haut, pas
    // sous une rangée.
    expect(screen.getAllByTestId('input-item-name')).toHaveLength(1);
    expect(screen.getByTestId('input-item-name').closest('.card')).not.toBe(
      screen.getByTestId('item-row-pain').nextElementSibling,
    );

    // Le listener Escape n'est monté que pour la carte d'édition : Escape ne
    // ferme PAS la création — il faut passer par Annuler.
    pressEscape();
    expect(screen.getByTestId('input-item-name')).toBeInTheDocument();
    expect(screen.getByTestId('btn-create-item')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-cancel-item'));
    expect(screen.queryByTestId('input-item-name')).not.toBeInTheDocument();
  });
});

// Ticket #252 MS2 : contrat du champ « Quantité à acheter » dans la carte
// d'édition — édition uniquement (création sans champ ni clé), pré-remplissage
// depuis la ligne, payload update explicite number|null (clear d'intention),
// et refus sans écriture pour un entier < 1.
describe('#252 : buy_quantity (édition)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpcDeltas.length = 0;
    updatePayloads = [];
    setOnLine(true);
    jest.mocked(createClient).mockReturnValue(mockClient() as never);
  });

  async function renderPage() {
    render(
      <LanguageProvider>
        <ItemsPage />
      </LanguageProvider>
    );
    return screen.findByTestId('btn-edit-item-item-1');
  }

  function mockItemWithBuyQuantity(buyQuantity: number) {
    jest
      .mocked(createClient)
      .mockReturnValue(mockClient({ items: () => [{ ...itemRow(), buy_quantity: buyQuantity }] }) as never);
  }

  it('le champ n\'existe pas en création', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-new-item'));
    await screen.findByTestId('input-item-name');
    // Panneau de création ouvert : aucun champ buy_quantity (ni en édition
    // implicite — editingId === null est la seule condition du rendu).
    expect(screen.queryByTestId('input-item-buy-quantity')).not.toBeInTheDocument();
  });

  it('l\'édition pré-remplit avec la valeur de l\'article', async () => {
    mockItemWithBuyQuantity(3);
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    const buyInput = await screen.findByTestId('input-item-buy-quantity');
    expect(buyInput).toHaveValue(3);
  });

  it('modifier puis enregistrer persiste la valeur', async () => {
    mockItemWithBuyQuantity(3);
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    const buyInput = await screen.findByTestId('input-item-buy-quantity');

    fireEvent.change(buyInput, { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('btn-create-item'));

    await waitFor(() => expect(updatePayloads).toHaveLength(1));
    expect(updatePayloads[updatePayloads.length - 1]).toMatchObject({ buy_quantity: 5 });
  });

  it('vider le champ efface l\'intention', async () => {
    mockItemWithBuyQuantity(3);
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    const buyInput = await screen.findByTestId('input-item-buy-quantity');

    fireEvent.change(buyInput, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('btn-create-item'));

    // Le champ voyage TOUJOURS explicitement en édition : '' → null explicite
    // (effacement), jamais une clé absente qui laisserait l'intention en place.
    await waitFor(() => expect(updatePayloads).toHaveLength(1));
    expect(updatePayloads[updatePayloads.length - 1]).toMatchObject({ buy_quantity: null });
  });

  it('\'0\' est refusé avec le message et sans écriture', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('btn-edit-item-item-1'));
    const buyInput = await screen.findByTestId('input-item-buy-quantity');

    fireEvent.change(buyInput, { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('btn-create-item'));

    await screen.findByTestId('error-buy-quantity-invalid');
    expect(updatePayloads).toHaveLength(0);
    // Le formulaire reste ouvert (la validation bloque avant setMutating).
    expect(screen.getByTestId('input-item-name')).toBeInTheDocument();
  });
});
