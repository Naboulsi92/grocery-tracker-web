import { fireEvent, render, screen, act, cleanup } from '@testing-library/react';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { LanguageProvider } from '@/contexts/LanguageContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

describe('PwaInstallBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  });

  afterEach(() => {
    view = null;
    cleanup();
  });

  let view: ReturnType<typeof render> | null = null;

  const simulateVisit = () => {
    view?.unmount();
    view = render(
      <LanguageProvider>
        <PwaInstallBanner />
      </LanguageProvider>,
    );
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });
  };

  it('does not render on the first visit', () => {
    simulateVisit();
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });

  it('renders from the 2nd visit on, and dismiss hides it for the current visit', () => {
    simulateVisit();

    simulateVisit();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa-banner-dismissals')).toBe('1');
  });

  it('reappears on a future visit until 2 dismissals, then stays hidden', () => {
    simulateVisit();

    simulateVisit();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));

    simulateVisit();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));
    expect(localStorage.getItem('pwa-banner-dismissals')).toBe('2');

    simulateVisit();
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });

  it('does not render when already installed (standalone display mode)', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: query === '(display-mode: standalone)',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });

    simulateVisit();
    simulateVisit();

    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });
});