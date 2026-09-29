import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import { createClient } from '@/utils/supabase/client';
import { LanguageProvider } from '@/contexts/LanguageContext';

const push = jest.fn();
const updateRecoveryPassword = jest.fn();
const signOut = jest.fn();
const getSession = jest.fn();
let mockAccessStatus = 'member';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    access: { status: mockAccessStatus },
    updateRecoveryPassword,
    signOut,
  }),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));
jest.mock('@/components/ThemeToggle', () => () => null);

describe('ResetPasswordPage (ticket #164)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessStatus = 'member';
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    updateRecoveryPassword.mockResolvedValue({ error: null });
    signOut.mockResolvedValue(undefined);
    jest.mocked(createClient).mockReturnValue({ auth: { getSession } } as never);
  });

  it('shows the expired state with a retry path when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<LanguageProvider><ResetPasswordPage /></LanguageProvider>);

    expect(await screen.findByTestId('reset-request-new-link')).toBeVisible();
    expect(updateRecoveryPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords without calling the API', async () => {
    render(<LanguageProvider><ResetPasswordPage /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId('reset-submit-button')).toBeVisible());

    fireEvent.change(screen.getByTestId('reset-new-password-input'), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm-password-input'), { target: { value: 'different2' } });
    fireEvent.click(screen.getByTestId('reset-submit-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent('ne correspondent pas');
    expect(updateRecoveryPassword).not.toHaveBeenCalled();
  });

  it('updates, signs out and lands on login once anonymous (decision 6)', async () => {
    const { rerender } = render(<LanguageProvider><ResetPasswordPage /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId('reset-submit-button')).toBeVisible());

    fireEvent.change(screen.getByTestId('reset-new-password-input'), { target: { value: 'newpassword1' } });
    fireEvent.change(screen.getByTestId('reset-confirm-password-input'), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByTestId('reset-submit-button'));

    await waitFor(() => expect(updateRecoveryPassword).toHaveBeenCalledWith('newpassword1'));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    // Still resolved as member: no premature push (the /home bounce race).
    expect(push).not.toHaveBeenCalled();

    mockAccessStatus = 'anonymous';
    rerender(<LanguageProvider><ResetPasswordPage /></LanguageProvider>);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
