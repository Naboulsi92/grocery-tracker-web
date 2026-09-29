import { render, waitFor } from '@testing-library/react';
import AuthCallbackPage from '@/app/auth/callback/page';
import { createClient } from '@/utils/supabase/client';
import { LanguageProvider } from '@/contexts/LanguageContext';

const replace = jest.fn();
const getSession = jest.fn();
const verifyOtp = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams('next=%2Freset-password'),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('AuthCallbackPage (ticket #164)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createClient).mockReturnValue({
      auth: { getSession, verifyOtp },
    } as never);
  });

  it('forwards to the reset page when a session exists', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password'));
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('fails closed to forgot with an error when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/forgot-password?error=expired')
    );
  });
});
