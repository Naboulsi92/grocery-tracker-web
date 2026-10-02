'use client';

import { useI18n } from '@/contexts/LanguageContext';

const SUPPORT_EMAIL = 'grocerytrackersupport@gmail.com';

export function ContactContent() {
  const { t } = useI18n();

  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>{t('contact.title')}</h1>

        <p className="mk-legal-lede">{t('contact.intro')}</p>

        <h2>{t('contact.support_title')}</h2>
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>

        <h2>{t('contact.privacy_title')}</h2>
        <p>
          {t('contact.privacy_body')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h2>{t('contact.legal_title')}</h2>
        <p>
          {t('contact.legal_body')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <p>
          {t('contact.see_also_pre')}{' '}
          <a href="/privacy">{t('contact.see_also_privacy')}</a>{' '}
          {t('contact.see_also_and')}{' '}
          <a href="/terms">{t('contact.see_also_terms')}</a>
          {t('contact.see_also_end')}
        </p>
      </div>
    </div>
  );
}
