import { render, screen } from '@testing-library/react';
import { Header } from '@/components/marketing/Header';
import { LanguageProvider } from '@/contexts/LanguageContext';

const replace = jest.fn();

jest.mock('next/link', () => function MockLink({
  children,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href as string} {...props}>
      {children}
    </a>
  );
});
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const authState = {
  user: null as { id: string } | null,
  loading: true,
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));
jest.mock('@/components/ThemeToggle', () => () => null);
jest.mock('@/components/LanguageToggle', () => () => null);
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

describe('marketing Header session awareness (ticket #48)', () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = true;
  });

  it('shows Connexion/Inscription while the session resolves (no flash for visitors)', () => {
    render(
      <LanguageProvider>
        <Header />
      </LanguageProvider>
    );
    expect(screen.getByRole('link', { name: 'Connexion' })).toBeVisible();
    expect(screen.getByRole('link', { name: "S'inscrire" })).toBeVisible();
    expect(screen.queryByTestId('mk-dashboard-link')).not.toBeInTheDocument();
  });

  it('keeps Connexion/Inscription for anonymous visitors', () => {
    authState.loading = false;
    render(
      <LanguageProvider>
        <Header />
      </LanguageProvider>
    );
    expect(screen.getByRole('link', { name: 'Connexion' })).toBeVisible();
    expect(screen.queryByTestId('mk-dashboard-link')).not.toBeInTheDocument();
  });

  it('offers the dashboard to signed-in visitors', () => {
    authState.loading = false;
    authState.user = { id: 'user-1' };
    render(
      <LanguageProvider>
        <Header />
      </LanguageProvider>
    );
    const dashboard = screen.getByTestId('mk-dashboard-link');
    expect(dashboard).toBeVisible();
    expect(dashboard).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Connexion' })).not.toBeInTheDocument();
  });
});
