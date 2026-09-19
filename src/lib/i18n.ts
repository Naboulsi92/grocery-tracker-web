import i18next from 'i18next';
import { FR_KEYS, resources } from '@/i18n/resources';
import {
  DEFAULT_LANGUAGE,
  getAvailableLanguages,
  isLanguage,
  NAMESPACE,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@/i18n/settings';

/**
 * i18next core instance (no React binding) used by non-component helpers
 * (`src/lib/history.ts`, `src/lib/household.ts`) and the `translateMessage`
 * shim. This module is SSR-safe: i18next core runs on both server and client,
 * and the resources are bundled, so no network fetch is involved.
 *
 * `keySeparator: false` — the locale files keep the historic flat dotted keys
 * ("common.loading"), so i18next must match the literal key instead of
 * traversing nested objects.
 * `prefix: '{' / suffix: '}'` — preserves the legacy single-brace `{var}`
 * interpolation used by every resource value ("Retry in {seconds} seconds."),
 * so the next-i18next resource files move over without value rewrites.
 */
export const i18n = i18next.createInstance();

i18n.init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  ns: [NAMESPACE],
  defaultNS: NAMESPACE,
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    prefix: '{',
    suffix: '}',
    escapeValue: false,
  },
  initAsync: false,
  returnNull: false,
});

export type { Language };

export { DEFAULT_LANGUAGE, isLanguage, getAvailableLanguages };

type InterpolationVars = Record<string, string | number>;

export function translate(
  language: Language,
  key: string,
  vars?: InterpolationVars,
): string {
  return i18n.getFixedT(language, NAMESPACE)(key, vars);
}

/**
 * Resolves a message that may be either a dictionary key (returned by
 * validation / account helpers) or a literal string (programmatic error
 * mapping kept in French). Keys are translated, literals pass through.
 */
export function translateMessage(
  language: Language,
  message: string,
  vars?: InterpolationVars,
): string {
  if (FR_KEYS.has(message)) return translate(language, message, vars);
  return message;
}