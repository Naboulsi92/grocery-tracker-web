import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SignupPage from '@/app/(auth)/signup/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { isPasswordBreached } from '@/lib/passwordBreach';

const push = jest.fn();
const replace = jest.fn();
const signUp = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ access: { status: 'signed-out' }, loading: false, signUp }),
}));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));
jest.mock('@/lib/passwordBreach', () => ({ isPasswordBreached: jest.fn() }));

describe('SignupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isPasswordBreached).mockResolvedValue(false);
  });

  it('rejects passwords shorter than the configured minimum', () => {
    render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: '1234567' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: '1234567' } });
    fireEvent.click(screen.getByTestId('signup-consent-checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('au moins 8 caractères');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rejects a breached password without calling signUp', async () => {
    jest.mocked(isPasswordBreached).mockResolvedValueOnce(true);
    render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: 'LongEnough123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'LongEnough123' } });
    fireEvent.click(screen.getByTestId('signup-consent-checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('compromis');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('blocks submit without explicit consent (ticket #225)', () => {
    render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: 'LongEnough123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'LongEnough123' } });
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent('accepter la politique');
    expect(signUp).not.toHaveBeenCalled();
    expect(isPasswordBreached).not.toHaveBeenCalled();
  });

  it('shows the check-inbox notice when no session is issued (ticket #227)', async () => {
    signUp.mockResolvedValueOnce({ error: null, needsConfirmation: true });
    render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: 'LongEnough123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'LongEnough123' } });
    fireEvent.click(screen.getByTestId('signup-consent-checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    expect(await screen.findByTestId('signup-check-inbox')).toHaveTextContent('boîte mail');
    expect(push).not.toHaveBeenCalled();
  });

  it('pushes to onboarding when a session is issued', async () => {
    signUp.mockResolvedValueOnce({ error: null, needsConfirmation: false });
    render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Mot de passe', { exact: true }), { target: { value: 'LongEnough123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'LongEnough123' } });
    fireEvent.click(screen.getByTestId('signup-consent-checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: "S'inscrire" }).closest('form')!);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/join-household'));
    expect(screen.queryByTestId('signup-check-inbox')).not.toBeInTheDocument();
  });
});
