import { fireEvent, render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { LanguageProvider } from '@/contexts/LanguageContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({}) as never,
}));

describe('PwaInstallBanner (PRD §4.13)', () => {
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

  const visits = () => Number(localStorage.getItem('pwa-banner-visits') ?? 0);

  it('does not render on the first visit', () => {
    simulateVisit();
    expect(visits()).toBe(1);
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });

  it('renders from the 2nd visit on, and dismiss hides it for the current visit', () => {
    simulateVisit();

    simulateVisit();
    expect(visits()).toBe(2);
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa-banner-snoozed-at')).toBe('2');
  });

  it('stays hidden on the next visit, reappears after 2 further visits', () => {
    simulateVisit();
    simulateVisit();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));

    // +1 visit after dismissal: still snoozed.
    simulateVisit();
    expect(visits()).toBe(3);
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();

    // +2 visits after dismissal: reappears.
    simulateVisit();
    expect(visits()).toBe(4);
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
  });

  it('snoozes again on every dismissal (no permanent hide)', () => {
    simulateVisit();
    simulateVisit();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));

    simulateVisit();
    simulateVisit();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pwa-install-dismiss'));
    expect(localStorage.getItem('pwa-banner-snoozed-at')).toBe('4');

    simulateVisit();
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();

    simulateVisit();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();
  });

  it('never returns once installed via the appinstalled event', () => {
    simulateVisit();
    simulateVisit();
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem('pwa-banner-installed')).toBe('1');

    simulateVisit();
    simulateVisit();
    expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
  });

  it('never returns once the install prompt is accepted', async () => {
    const prompt = jest.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'test' });
    simulateVisit();
    simulateVisit();

    act(() => {
      const event = new Event('beforeinstallprompt');
      (event as unknown as { prompt: () => Promise<void> }).prompt = prompt;
      (event as unknown as { userChoice: typeof userChoice }).userChoice = userChoice;
      window.dispatchEvent(event);
    });
    expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('pwa-install-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument();
    });
    expect(prompt).toHaveBeenCalled();
    expect(localStorage.getItem('pwa-banner-installed')).toBe('1');

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
