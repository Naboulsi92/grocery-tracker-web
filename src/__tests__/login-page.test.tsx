import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';
import { LanguageProvider } from '@/contexts/LanguageContext';

const push = jest.fn();
const signIn = jest.fn();
const signInWithProvider = jest.fn();
const resendConfirmationEmail = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    access: { status: 'signed-out' },
    loading: false,
    user: null,
    signIn,
    signInWithProvider,
    resendConfirmationEmail,
  }),
}));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

function fillLogin() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'LongEnough123' } });
}

// Ticket #227 : l'email non confirmé bloque côté serveur — le login doit
// proposer le renvoi au lieu de laisser l'utilisateur sans issue.
describe('LoginPage email confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderPage() {
    render(
      <LanguageProvider>
        <LoginPage />
      </LanguageProvider>,
    );
  }

  it('shows the resend button on unconfirmed-email error', async () => {
    signIn.mockResolvedValueOnce({ error: new Error('Email not confirmed') });
    renderPage();
    fillLogin();
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('non confirmé');
    expect(screen.getByTestId('login-resend-confirmation')).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });

  it('resends the confirmation and shows the sent notice', async () => {
    signIn.mockResolvedValueOnce({ error: new Error('Email not confirmed') });
    resendConfirmationEmail.mockResolvedValueOnce({ error: null });
    renderPage();
    fillLogin();
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!);

    fireEvent.click(await screen.findByTestId('login-resend-confirmation'));

    await waitFor(() =>
      expect(resendConfirmationEmail).toHaveBeenCalledWith('user@example.test'),
    );
    expect(await screen.findByTestId('login-confirmation-resent')).toHaveTextContent(
      'boîte mail',
    );
  });

  it('shows no resend button for other errors', async () => {
    signIn.mockResolvedValueOnce({ error: new Error('Invalid login credentials') });
    renderPage();
    fillLogin();
    fireEvent.submit(screen.getByRole('button', { name: 'Se connecter' }).closest('form')!);

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByTestId('login-resend-confirmation')).not.toBeInTheDocument();
  });
});
