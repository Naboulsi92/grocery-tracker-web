import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MembersPage from '@/app/members/page';
import { createClient } from '@/utils/supabase/client';

const writeText = jest.fn();
const rpc = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' }, householdId: 'household-1' }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('next/link', () => function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href as string} {...props}>{children}</a>;
});

function query(result: unknown) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
    in: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.in.mockResolvedValue(result);
  return builder;
}

describe('MembersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    writeText.mockResolvedValue(undefined);

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
        { id: 'owner-1', display_name: 'Alex' },
        { id: 'member-2', display_name: 'Sam' },
      ],
      error: null,
    });
    const from = jest.fn((table: string) => {
      if (table === 'households') return household;
      if (table === 'household_members') return memberships;
      return profiles;
    });
    jest.mocked(createClient).mockReturnValue({ from, rpc } as never);
  });

  it('loads the household and exposes members through accessible content', async () => {
    render(<MembersPage />);

    expect(await screen.findByRole('heading', { name: 'Membres de Foyer des tests' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Membres du foyer (2)' })).toBeVisible();
    expect(screen.getByText('Alex')).toBeVisible();
    expect(screen.getByText('Sam')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/home');
  });

  it('creates, copies and revokes an opaque invitation without truncating it', async () => {
    const invitation = {
      invitation_id: 'invite-1',
      token: 'fixture-id',
      expires_at: '2026-09-07T10:00:00Z',
    };
    rpc
      .mockResolvedValueOnce({ data: [invitation], error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    render(<MembersPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Créer une invitation' }));
    expect(await screen.findByText(invitation.token)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(invitation.token));
    expect(screen.getByText('Code d’invitation complet copié dans le presse-papiers')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Révoquer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Créer une invitation' })).toBeVisible());
    expect(rpc).toHaveBeenLastCalledWith('revoke_household_invitation', { p_invitation_id: 'invite-1' });
  });

  it('offers a retry when loading the household fails', async () => {
    const failedHousehold = query({ data: null, error: { message: 'service indisponible' } });
    const memberships = query({ data: [], error: null });
    const from = jest.fn((table: string) => table === 'households' ? failedHousehold : memberships);
    jest.mocked(createClient).mockReturnValue({ from, rpc } as never);
    render(<MembersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger le foyer. Vous pouvez réessayer.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('service indisponible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(from).toHaveBeenCalledTimes(4));
  });
});
