'use client';

import { useI18n } from '@/contexts/LanguageContext';
import { getAvailableLanguages, type Language } from '@/lib/i18n';

const LANGUAGE_LABELS: Record<Language, string> = { fr: 'FR', en: 'EN' };
const LANGUAGE_NAMES: Record<Language, string> = { fr: 'Français', en: 'English' };

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="language-toggle" role="group" aria-label={t('lang.label')}>
      {getAvailableLanguages().map((code) => (
        <button
          key={code}
          type="button"
          className="language-toggle__button"
          aria-pressed={language === code}
          aria-label={LANGUAGE_NAMES[code]}
          title={LANGUAGE_NAMES[code]}
          onClick={() => setLanguage(code)}
          data-testid={`language-toggle-${code}`}
        >
          {LANGUAGE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}