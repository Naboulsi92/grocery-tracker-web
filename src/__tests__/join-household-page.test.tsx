import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JoinHouseholdPage from '@/app/(auth)/join-household/page';
import { createClient } from '@/utils/supabase/client';
import { LanguageProvider } from '@/contexts/LanguageContext';

const replace = jest.fn();
const retryHousehold = jest.fn();
const rpc = jest.fn();
const profileUpdate = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    access: { status: 'no-household', user: { id: 'user-1' } },
    user: { id: 'user-1' },
    retryHousehold,
  }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

function fillNames(firstName: string, lastName: string) {
  fireEvent.change(screen.getByTestId('onboarding-first-name-input'), { target: { value: firstName } });
  fireEvent.change(screen.getByTestId('onboarding-last-name-input'), { target: { value: lastName } });
}

describe('JoinHouseholdPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: 'household-1', error: null });
    const fromChain = {
      select: () => fromChain,
      eq: () => fromChain,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      update: profileUpdate.mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }),
    };
    jest.mocked(createClient).mockReturnValue({ rpc, from: jest.fn(() => fromChain) } as never);
  });

  it('creates a named household and refreshes private access', async () => {
    render(<LanguageProvider><JoinHouseholdPage /></LanguageProvider>);
    fireEvent.change(screen.getByLabelText('Nom du foyer'), { target: { value: '  Foyer démo  ' } });
    fillNames('Alex', 'Dupont');
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon foyer' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_household', { p_name: 'Foyer démo' }));
    expect(profileUpdate).toHaveBeenCalledWith({ first_name: 'Alex', last_name: 'Dupont' });
    expect(profileUpdate.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    expect(retryHousehold).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/home');
  });

  it('submits the complete normalized invitation token', async () => {
    render(<LanguageProvider><JoinHouseholdPage /></LanguageProvider>);
    fillNames('Alex', 'Dupont');
    fireEvent.change(screen.getByLabelText(/Code d.invitation complet/), {
      target: { value: '  fixture-id  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le foyer' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('consume_household_invitation', {
      p_token: 'fixture-id',
    }));
    expect(profileUpdate).toHaveBeenCalledWith({ first_name: 'Alex', last_name: 'Dupont' });
    expect(replace).toHaveBeenCalledWith('/home');
  });

  it('keeps an invalid invitation recoverable without redirecting', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'invitation is invalid or unavailable' } });
    render(<LanguageProvider><JoinHouseholdPage /></LanguageProvider>);
    fillNames('Alex', 'Dupont');
    fireEvent.change(screen.getByLabelText(/Code d.invitation complet/), { target: { value: 'bad-token' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rejoindre le foyer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Code invalide ou expiré');
    expect(rpc).toHaveBeenCalledWith('consume_household_invitation', { p_token: 'bad-token' });
    expect(profileUpdate).toHaveBeenCalledWith({ first_name: 'Alex', last_name: 'Dupont' });
    expect(screen.getByRole('button', { name: 'Rejoindre le foyer' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
