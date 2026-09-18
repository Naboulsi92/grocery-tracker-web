'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfile, updateProfileLanguage } from '@/lib/account';
import { i18n } from '@/i18n/client';
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  NAMESPACE,
  type Language,
} from '@/i18n/settings';

type InterpolationVars = Record<string, string | number>;

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language, options?: { persist?: boolean }) => void;
  t: (key: string, vars?: InterpolationVars) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [supabase] = useState(createClient);
  const { t: translateFn } = useTranslation(NAMESPACE);
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchProfile(supabase, user.id).then(({ profile }) => {
      if (!active || !profile) return;
      if (isLanguage(profile.language)) {
        setLanguageState(profile.language);
        document.documentElement.lang = profile.language;
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, profile.language);
        void i18n.changeLanguage(profile.language);
      }
    });
    return () => {
      active = false;
    };
  }, [supabase, user]);

  const setLanguage = useCallback(
    (next: Language, options?: { persist?: boolean }) => {
      setLanguageState(next);
      document.documentElement.lang = next;
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      void i18n.changeLanguage(next);
      if (user && options?.persist !== false) {
        void updateProfileLanguage(supabase, user.id, next).then(({ error }) => {
          if (error) console.warn('language_persist_failed', { area: 'language', error });
        });
      }
    },
    [supabase, user],
  );

  const t = useCallback(
    (key: string, vars?: InterpolationVars) => translateFn(key, vars),
    [translateFn],
  );

  const value = useMemo<LanguageContextType>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return context;
}