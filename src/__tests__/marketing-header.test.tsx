import { render, screen } from '@testing-library/react';
import { Header } from '@/components/marketing/Header';

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

describe('marketing Header session awareness (ticket #48)', () => {
  beforeEach(() => {
    authState.user = null;
    authState.loading = true;
  });

  it('shows Login/Signup while the session resolves (no flash for visitors)', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Signup' })).toBeVisible();
    expect(screen.queryByTestId('mk-dashboard-link')).not.toBeInTheDocument();
  });

  it('keeps Login/Signup for anonymous visitors', () => {
    authState.loading = false;
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
    expect(screen.queryByTestId('mk-dashboard-link')).not.toBeInTheDocument();
  });

  it('offers the dashboard to signed-in visitors', () => {
    authState.loading = false;
    authState.user = { id: 'user-1' };
    render(<Header />);
    const dashboard = screen.getByTestId('mk-dashboard-link');
    expect(dashboard).toBeVisible();
    expect(dashboard).toHaveAttribute('href', '/home');
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  });
});
