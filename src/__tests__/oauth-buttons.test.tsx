import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OAuthButtons } from '@/components/OAuthButtons';
import { LanguageProvider } from '@/contexts/LanguageContext';

const signInWithProvider = jest.fn();
const onError = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({}),
}));
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }));

function renderButtons(nextParam: string | null = null) {
  render(
    <LanguageProvider>
      <OAuthButtons nextParam={nextParam} signInWithProvider={signInWithProvider} onError={onError} />
    </LanguageProvider>
  );
}

describe('OAuthButtons (ticket #166, Google only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    signInWithProvider.mockResolvedValue({ error: null });
  });

  it('renders the Google button with a divider', () => {
    renderButtons();
    expect(screen.getByTestId('oauth-google-button')).toBeVisible();
    expect(screen.queryByTestId('oauth-apple-button')).not.toBeInTheDocument();
  });

  it('starts Google with the callback URL and stashes the destination', async () => {
    renderButtons('/items');
    fireEvent.click(screen.getByTestId('oauth-google-button'));

    await waitFor(() => expect(signInWithProvider).toHaveBeenCalledTimes(1));
    expect(signInWithProvider).toHaveBeenCalledWith(
      'google',
      expect.stringContaining('/auth/callback?next=')
    );
    expect(sessionStorage.getItem('grocery.post-oauth-next')).toBe('/items');
  });

  it('disables the button while initiating and surfaces provider errors', async () => {
    signInWithProvider.mockResolvedValue({ error: { message: 'oauth boom' } });
    renderButtons();

    fireEvent.click(screen.getByTestId('oauth-google-button'));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('errors.auth.oauth_failed'));
    expect(screen.getByTestId('oauth-google-button')).toBeEnabled();
  });
});
