import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HouseholdPage from '@/app/household/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createClient } from '@/utils/supabase/client';

const writeText = jest.fn();
const rpc = jest.fn();

function renderWithLanguage(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, householdId: 'household-1' }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/components/AuthenticatedHeader', () => ({
  AuthenticatedHeader: () => null,
}));

function query(result: unknown) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
    in: jest.fn(),
    update: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.in.mockResolvedValue(result);
  builder.update.mockReturnValue(builder);
  return builder;
}

// Ticket #173 : useHousehold subscribes the live roster channel — the mock
// client needs channel/removeChannel stubs at every site.
function withChannel(client: Record<string, unknown>) {
  const channelStub = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  return {
    ...client,
    channel: jest.fn().mockReturnValue(channelStub),
    removeChannel: jest.fn(),
  } as never;
}

function mockHouseholdData() {
  const household = query({ data: { id: 'household-1', name: 'Foyer des tests' }, error: null });
  const memberships = query({
    data: [
      { user_id: 'owner-1', role: 'owner', joined_at: '2026-08-30T12:00:00Z' },
      { user_id: 'member-2', role: 'member', joined_at: null },
    ],
    error: null,
  });
  const profiles = query({
    data: [
      { id: 'owner-1', first_name: 'Alex', last_name: 'Dupont' },
      { id: 'member-2', first_name: 'Sam', last_name: 'Smith' },
    ],
    error: null,
  });
  const from = jest.fn((table: string) => {
    if (table === 'households') return household;
    if (table === 'household_members') return memberships;
    return profiles;
  });
  jest.mocked(createClient).mockReturnValue(withChannel({ from, rpc }));
  return { from };
}

describe('HouseholdPage (fusion Membres → Foyer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    writeText.mockResolvedValue(undefined);
    mockHouseholdData();
    // Mount hydration (read function, no pending invitation) comes first.
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it('renders the household name, members and roles', async () => {
    renderWithLanguage(<HouseholdPage />);

    expect(await screen.findByRole('heading', { name: 'Foyer des tests' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();
    expect(screen.getByText('Alex Dupont')).toBeVisible();
    expect(screen.getByText('Sam Smith')).toBeVisible();
    expect(screen.getByText(/Propriétaire/)).toBeVisible();
    expect(screen.getByText('Membre', { exact: true })).toBeVisible();
    expect(screen.getByText('Vous')).toBeVisible();
  });

  it('renames the household and shows a confirmation', async () => {
    const { from } = mockHouseholdData();
    renderWithLanguage(<HouseholdPage />);

    fireEvent.change(await screen.findByTestId('household-name-input'), {
      target: { value: 'Nouveau foyer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder' }));

    await waitFor(() => expect(screen.getByText('Sauvegardé')).toBeVisible());
    const householdsQuery = from.mock.results
      .map((call) => call.value)
      .find((builder) => builder.update.mock.calls.length > 0);
    expect(householdsQuery.update).toHaveBeenCalledWith({ name: 'Nouveau foyer' });
  });

  it('creates and copies an invitation without truncating it', async () => {
    const invitation = {
      invitation_id: 'invite-1',
      token: 'fixture-id',
      expires_at: '2026-09-07T10:00:00Z',
    };
    // Mount hydration first, then create — mirroring the hook's call order.
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [invitation], error: null });

    renderWithLanguage(<HouseholdPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Générer un code' }));
    expect(await screen.findByText(invitation.token)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Copier', exact: true }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(invitation.token));
    expect(await screen.findByText('Copié !')).toBeVisible();
  });

  it('regenerates the invitation behind a confirmation dialog', async () => {
    const first = {
      invitation_id: 'invite-1',
      token: 'first-token',
      expires_at: '2026-09-07T10:00:00Z',
    };
    const second = {
      invitation_id: 'invite-2',
      token: 'second-token',
      expires_at: '2026-09-08T10:00:00Z',
    };
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [first], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [second], error: null });

    renderWithLanguage(<HouseholdPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Générer un code' }));
    expect(await screen.findByText(first.token)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }));
    expect(await screen.findByText("Régénérer le code d'invitation ?")).toBeVisible();

    fireEvent.click(screen.getByTestId('invite-code-regenerate-confirm'));
    expect(await screen.findByText(second.token)).toBeVisible();
    expect(rpc).toHaveBeenCalledWith('revoke_household_invitation', { p_invitation_id: 'invite-1' });
  });

  it('revokes the invitation from the pending view', async () => {
    // Reload path: hydration returns a live pending row (no token by design),
    // the pending view offers revoke, back to the create affordance.
    const pendingRow = {
      invitation_id: 'invite-1',
      created_at: '2026-09-06T10:00:00Z',
      expires_at: '2026-09-07T10:00:00Z',
      revoked_at: null,
      consumed_at: null,
    };
    rpc
      .mockResolvedValueOnce({ data: [pendingRow], error: null })
      .mockResolvedValue({ data: true, error: null });

    renderWithLanguage(<HouseholdPage />);

    expect(await screen.findByTestId('invite-pending-display')).toBeVisible();
    expect(screen.getByTestId('invite-pending-note')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    expect(await screen.findByRole('button', { name: 'Générer un code' })).toBeVisible();
    expect(rpc).toHaveBeenCalledWith('revoke_household_invitation', { p_invitation_id: 'invite-1' });
  });

  it('leaves the household through the confirmation dialog', async () => {
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValue({ error: null });

    renderWithLanguage(<HouseholdPage />);

    fireEvent.click(await screen.findByTestId('leave-household-button'));
    expect(await screen.findByText('Quitter le foyer ?')).toBeVisible();

    fireEvent.click(screen.getByTestId('leave-household-confirm'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('leave_household'));
    expect(await screen.findByText('Vous avez quitté le foyer')).toBeVisible();
  });

  it('surfaces a load error without leaking internals', async () => {
    const failedHousehold = query({ data: null, error: { message: 'service indisponible' } });
    const memberships = query({ data: [], error: null });
    const from = jest.fn((table: string) => table === 'households' ? failedHousehold : memberships);
    jest.mocked(createClient).mockReturnValue(withChannel({ from, rpc }));
    renderWithLanguage(<HouseholdPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger le foyer. Vous pouvez réessayer.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('service indisponible');
  });
});
