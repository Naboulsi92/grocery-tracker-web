import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import { createClient } from '@/utils/supabase/client';
import { LanguageProvider } from '@/contexts/LanguageContext';

const requestPasswordReset = jest.fn();
const rpc = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ requestPasswordReset }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('ForgotPasswordPage (ticket #164)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rpc.mockResolvedValue({ data: true, error: null });
    requestPasswordReset.mockResolvedValue({ error: null });
    jest.mocked(createClient).mockReturnValue({ rpc } as never);
  });

  function submit(email: string) {
    render(<LanguageProvider><ForgotPasswordPage /></LanguageProvider>);
    fireEvent.change(screen.getByTestId('forgot-email-input'), { target: { value: email } });
    fireEvent.click(screen.getByTestId('forgot-submit-button'));
  }

  it('shows an explicit error for an unknown email without sending anything', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    submit('ghost@example.test');

    expect(await screen.findByRole('alert')).toHaveTextContent("Aucun compte n'existe avec cet email");
    expect(rpc).toHaveBeenCalledWith('email_exists', { p_email: 'ghost@example.test' });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('normalizes the email, sends the link and shows the success screen', async () => {
    submit('  User@Example.TEST ');

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1));
    expect(requestPasswordReset.mock.calls[0][0]).toBe('user@example.test');
    expect(requestPasswordReset.mock.calls[0][1]).toContain('/auth/callback');
    expect(await screen.findByTestId('forgot-success')).toBeVisible();
  });

  it('shows a provider notice instead of sending for OAuth accounts (ticket #166)', async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 'google', error: null });
    submit('user@example.test');

    expect(await screen.findByTestId('forgot-oauth-notice')).toHaveTextContent('Google');
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('maps a rate-limit failure instead of succeeding', async () => {
    requestPasswordReset.mockResolvedValue({ error: { message: 'over_email_send_rate_limit' } });
    submit('user@example.test');

    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives');
    expect(screen.queryByTestId('forgot-success')).not.toBeInTheDocument();
  });
});
