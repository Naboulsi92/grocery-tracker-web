import { render, waitFor } from '@testing-library/react';
import AuthCallbackPage from '@/app/auth/callback/page';
import { createClient } from '@/utils/supabase/client';
import { LanguageProvider } from '@/contexts/LanguageContext';

const replace = jest.fn();
const getSession = jest.fn();
const verifyOtp = jest.fn();
const maybeSingle = jest.fn();
let mockSearch = 'next=%2Freset-password';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('AuthCallbackPage recovery (ticket #164)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    jest.mocked(createClient).mockReturnValue({
      auth: { getSession, verifyOtp },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as never);
  });

  it('forwards a recovery session to the reset page', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    // Recovery shape without token_hash relies on the picked-up session;
    // membership is irrelevant here (reset page, not OAuth routing).
    maybeSingle.mockResolvedValue({ data: null, error: null });
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    // No household but a recovery ?next=: the reset page owns this flow.
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

describe('AuthCallbackPage OAuth routing (ticket #166)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    mockSearch = 'next=%2Freset-password';
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    jest.mocked(createClient).mockReturnValue({
      auth: { getSession, verifyOtp },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    } as never);
  });

  it('routes members to the validated ?next=', async () => {
    sessionStorage.setItem('grocery.post-oauth-next', '/items');
    maybeSingle.mockResolvedValue({
      data: { household_id: 'household-1' },
      error: null,
    });
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    // ?next= (mocked as /reset-password) wins over the stash.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/reset-password'));
    expect(sessionStorage.getItem('grocery.post-oauth-next')).toBe('/items');
  });

  it('routes new users without ?next= to onboarding via the stash (single use)', async () => {
    mockSearch = '';
    maybeSingle.mockResolvedValue({ data: null, error: null });
    sessionStorage.setItem('grocery.post-oauth-next', '/join-household?code=abc');
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/join-household?code=abc')
    );
    expect(sessionStorage.getItem('grocery.post-oauth-next')).toBeNull();
  });

  it('routes member newcomers to the dashboard by default', async () => {
    mockSearch = '';
    maybeSingle.mockResolvedValue({
      data: { household_id: 'household-1' },
      error: null,
    });
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });

  it('sends provider cancellations to login with a distinct error', async () => {
    mockSearch = 'error=access_denied&next=%2Fitems';
    render(<LanguageProvider><AuthCallbackPage /></LanguageProvider>);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/login?error=oauth_cancelled&next=%2Fitems')
    );
  });
});
