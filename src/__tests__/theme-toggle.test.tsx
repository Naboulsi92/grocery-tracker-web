import { fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/contexts/ThemeContext';

const matchMedia = jest.fn().mockImplementation(() => ({
  matches: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });
    document.documentElement.removeAttribute('data-theme');
  });

  it('exposes its state and accessible action', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'Thème sombre' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('title', 'Activer le thème sombre');
  });

  it('persists and applies the selected theme', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Thème sombre' }));

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Thème sombre' })).toHaveAttribute('aria-pressed', 'true');
  });
});
