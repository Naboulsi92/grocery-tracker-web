'use client';

import { createContext, ReactNode, useContext, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const THEME_KEY = 'theme';
const THEME_EVENT = 'theme-change';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeToTheme(onStoreChange: () => void) {
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const syncTheme = () => {
    const theme = getTheme();
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    onStoreChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) syncTheme();
  };

  window.addEventListener(THEME_EVENT, syncTheme);
  window.addEventListener('storage', handleStorage);
  colorScheme.addEventListener('change', syncTheme);

  return () => {
    window.removeEventListener(THEME_EVENT, syncTheme);
    window.removeEventListener('storage', handleStorage);
    colorScheme.removeEventListener('change', syncTheme);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, (): Theme => 'light');

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
