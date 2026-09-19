import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from '@/i18n/resources';
import {
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  NAMESPACE,
  SUPPORTED_LANGUAGES,
} from '@/i18n/settings';

/**
 * Client i18next instance bound to react-i18next. The initial language is read
 * from localStorage so the first render matches the persisted preference (the
 * same invariant the OLD custom provider guaranteed via lazy state init);
 * signed-in users are then re-synced from `profiles.language` by the provider.
 */
const detected =
  typeof window === 'undefined'
    ? null
    : window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

export const i18n = i18next.createInstance();

i18n.use(initReactI18next).init({
  resources,
  lng: isLanguage(detected) ? detected : DEFAULT_LANGUAGE,
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
  react: {
    useSuspense: false,
  },
});

export default i18n;