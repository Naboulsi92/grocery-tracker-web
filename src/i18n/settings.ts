export const DEFAULT_LANGUAGE = 'fr' as const;

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'language';

export const NAMESPACE = 'common';

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'fr' || value === 'en';
}

export function getAvailableLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}