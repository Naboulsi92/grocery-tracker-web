import type { Resource } from 'i18next';
import fr from './locales/fr/common.json';
import en from './locales/en/common.json';

/** next-i18next-style layout: one locale per language, one "common" namespace. */
export const resources: Resource = {
  fr: { common: { ...fr } },
  en: { common: { ...en } },
};

export const FR_KEYS = new Set<string>(Object.keys(fr));