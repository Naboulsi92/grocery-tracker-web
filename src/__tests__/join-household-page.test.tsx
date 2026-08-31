import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JoinHouseholdPage from '@/app/(auth)/join-household/page';
import { createClient } from '@/utils/supabase/client';

const replace = jest.fn();
const retryHousehold = jest.fn();
const rpc = jest.fn();

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ access: { status: 'no-household', user: { id: 'user-1' } }, retryHousehold }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('JoinHouseholdPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: 'household-1', error: null });
    jest.mocked(createClient).mockReturnValue({ rpc } as never);
  });

  it('creates a named household and refreshes private access', async () => {
    render(<JoinHouseholdPage />);
    fireEvent.change(screen.getByLabelText('Nom du foyer'), { target: { value: '  Foyer démo  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon foyer' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_household', { p_name: 'Foyer démo' }));
    expect(retryHousehold).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/home');
  });

  it('submits the complete normalized invitation token', async () => {
    render(<JoinHouseholdPage />);
    fireEvent.change(screen.getByLabelText(/Code d.invitation complet/), {
      target: { value: '  fixture-id  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le foyer' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('consume_household_invitation', {
      p_token: 'fixture-id',
    }));
    expect(replace).toHaveBeenCalledWith('/home');
  });

  it('keeps an invalid invitation recoverable without redirecting', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invitation is invalid or unavailable' } });
    render(<JoinHouseholdPage />);
    fireEvent.change(screen.getByLabelText(/Code d.invitation complet/), { target: { value: 'invalid-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le foyer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('invalide, expirée, révoquée ou déjà utilisée');
    expect(screen.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
