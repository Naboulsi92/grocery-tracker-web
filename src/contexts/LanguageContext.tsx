'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfile, updateProfileLanguage } from '@/lib/account';
import { DEFAULT_LANGUAGE, isLanguage, translate, type Language } from '@/lib/i18n';

const LANGUAGE_STORAGE_KEY = 'language';

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language, options?: { persist?: boolean }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [supabase] = useState(createClient);
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(stored)) {
      document.documentElement.lang = stored;
      return stored;
    }
    return DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    void fetchProfile(supabase, user.id).then(({ profile }) => {
      if (!active || !profile) return;
      if (isLanguage(profile.language)) {
        setLanguageState(profile.language);
        document.documentElement.lang = profile.language;
        localStorage.setItem(LANGUAGE_STORAGE_KEY, profile.language);
      }
    });
    return () => {
      active = false;
    };
  }, [supabase, user]);

  const value = useMemo<LanguageContextType>(() => {
    const setLanguage = (next: Language, options?: { persist?: boolean }) => {
      setLanguageState(next);
      document.documentElement.lang = next;
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      if (user && options?.persist !== false) {
        void updateProfileLanguage(supabase, user.id, next).then(({ error }) => {
          if (error) console.warn('language_persist_failed', { area: 'language', error });
        });
      }
    };

    const t = (key: string, vars?: Record<string, string | number>) =>
      translate(language, key, vars);

    return { language, setLanguage, t };
  }, [language, supabase, user]);

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within a LanguageProvider');
  }
  return context;
}