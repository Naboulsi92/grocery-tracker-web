import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AppError from '@/app/error';
import NotFound from '@/app/not-found';
import ItemsLoading from '@/app/items/loading';
import ToBuyLoading from '@/app/to-buy/loading';
import HomeLoading from '@/app/home/loading';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, householdId: null }),
}));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

function renderWithLanguage(children: React.ReactNode) {
  return render(<LanguageProvider>{children}</LanguageProvider>);
}

describe('error boundaries (ticket #122)', () => {
  it('error.tsx shows a translated message and retries on click', () => {
    const reset = jest.fn();
    const silence = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    renderWithLanguage(<AppError error={new Error('boom')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Quelque chose s'est mal passé");
    fireEvent.click(screen.getByTestId('error-boundary-retry'));
    expect(reset).toHaveBeenCalledTimes(1);
    silence.mockRestore();
  });

  it('not-found.tsx links home with a translated title', () => {
    renderWithLanguage(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page introuvable');
    const homeLink = screen.getByRole('link', { name: "Retour à l'accueil" });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('route loadings expose a status region', () => {
    for (const Loading of [ItemsLoading, ToBuyLoading, HomeLoading]) {
      const { unmount } = renderWithLanguage(<Loading />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    }
  });
});
