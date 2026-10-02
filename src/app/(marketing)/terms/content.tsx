'use client';

import { useI18n } from '@/contexts/LanguageContext';

const SUPPORT_EMAIL = 'grocerytrackersupport@gmail.com';

export function TermsContent() {
  const { t } = useI18n();

  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>{t('terms.title')}</h1>
        <p className="mk-legal-date">{t('terms.updated')}</p>

        <p>{t('terms.intro')}</p>

        <h2>{t('terms.s1_title')}</h2>
        <p>{t('terms.s1_body')}</p>

        <h2>{t('terms.s2_title')}</h2>
        <p>{t('terms.s2_body')}</p>

        <h2>{t('terms.s3_title')}</h2>
        <p>{t('terms.s3_lead')}</p>
        <ul>
          <li>{t('terms.s3_item1')}</li>
          <li>{t('terms.s3_item2')}</li>
          <li>{t('terms.s3_item3')}</li>
          <li>{t('terms.s3_item4')}</li>
          <li>{t('terms.s3_item5')}</li>
        </ul>

        <h2>{t('terms.s4_title')}</h2>
        <p>{t('terms.s4_body')}</p>

        <h2>{t('terms.s5_title')}</h2>
        <p>{t('terms.s5_body')}</p>

        <h2>{t('terms.s6_title')}</h2>
        <p>
          {t('terms.s6_body_pre')}{' '}
          <a href="/privacy">{t('terms.s6_link')}</a>
          {t('terms.s6_body_post')}
        </p>

        <h2>{t('terms.s7_title')}</h2>
        <p>{t('terms.s7_body')}</p>

        <h2>{t('terms.s8_title')}</h2>
        <p>{t('terms.s8_body')}</p>

        <h2>{t('terms.s9_title')}</h2>
        <p>{t('terms.s9_body')}</p>

        <h2>{t('terms.s10_title')}</h2>
        <p>{t('terms.s10_body')}</p>

        <h2>{t('terms.s11_title')}</h2>
        <p>
          {t('terms.s11_body')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}
