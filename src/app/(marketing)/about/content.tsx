'use client';

import { useI18n } from '@/contexts/LanguageContext';

export function AboutContent() {
  const { t } = useI18n();

  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>{t('about.title')}</h1>

        <p className="mk-legal-lede">{t('about.intro')}</p>

        <h2>{t('about.s1_title')}</h2>
        <p>{t('about.s1_body')}</p>

        <h2>{t('about.s2_title')}</h2>
        <ul>
          <li>{t('about.item1')}</li>
          <li>{t('about.item2')}</li>
          <li>{t('about.item3')}</li>
          <li>{t('about.item4')}</li>
        </ul>

        <h2>{t('about.contact_title')}</h2>
        <p>
          {t('about.contact_lead')}{' '}
          <a href="/contact">{t('about.contact_page')}</a>{' '}
          {t('about.contact_mid')}{' '}
          <a href="/privacy">{t('about.contact_privacy')}</a>{' '}
          {t('about.contact_and')}{' '}
          <a href="/terms">{t('about.contact_terms')}</a>
          {t('about.contact_end')}
        </p>
      </div>
    </div>
  );
}
