'use client';

import { useI18n } from '@/contexts/LanguageContext';

const SUPPORT_EMAIL = 'grocerytrackersupport@gmail.com';

export function PrivacyContent() {
  const { t } = useI18n();

  return (
    <div className="mk-legal">
      <div className="mk-legal-inner">
        <h1>{t('privacy.title')}</h1>
        <p className="mk-legal-date">{t('privacy.updated')}</p>

        <p>{t('privacy.intro')}</p>

        <h2>{t('privacy.s1_title')}</h2>
        <p>{t('privacy.s1_lead')}</p>
        <ul>
          <li>
            <strong>{t('privacy.s1_item1_label')}</strong> {t('privacy.s1_item1_body')}
          </li>
          <li>
            <strong>{t('privacy.s1_item2_label')}</strong> {t('privacy.s1_item2_body')}
          </li>
          <li>
            <strong>{t('privacy.s1_item3_label')}</strong> {t('privacy.s1_item3_body')}
          </li>
          <li>
            <strong>{t('privacy.s1_item4_label')}</strong> {t('privacy.s1_item4_body')}
          </li>
        </ul>

        <h2>{t('privacy.s2_title')}</h2>
        <p>{t('privacy.s2_lead')}</p>
        <ul>
          <li>{t('privacy.s2_item1')}</li>
          <li>{t('privacy.s2_item2')}</li>
          <li>{t('privacy.s2_item3')}</li>
          <li>{t('privacy.s2_item4')}</li>
          <li>{t('privacy.s2_item5')}</li>
        </ul>

        <h2>{t('privacy.s3_title')}</h2>
        <ul>
          <li>
            <strong>{t('privacy.s3_item1_label')}</strong> {t('privacy.s3_item1_body')}
          </li>
          <li>
            <strong>{t('privacy.s3_item2_label')}</strong> {t('privacy.s3_item2_body')}
          </li>
        </ul>

        <h2>{t('privacy.s4_title')}</h2>
        <p>{t('privacy.s4_lead')}</p>
        <ul>
          <li>
            <strong>{t('privacy.s4_item1_label')}</strong> {t('privacy.s4_item1_body')}
          </li>
          <li>
            <strong>{t('privacy.s4_item2_label')}</strong> {t('privacy.s4_item2_body')}
          </li>
          <li>
            <strong>{t('privacy.s4_item3_label')}</strong> {t('privacy.s4_item3_body')}
          </li>
          <li>
            <strong>{t('privacy.s4_item4_label')}</strong> {t('privacy.s4_item4_body')}
          </li>
          <li>
            <strong>{t('privacy.s4_item5_label')}</strong> {t('privacy.s4_item5_body')}
          </li>
        </ul>
        <p>
          {t('privacy.s4_contact')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>

        <h2>{t('privacy.s5_title')}</h2>
        <p>{t('privacy.s5_body')}</p>

        <h2>{t('privacy.s6_title')}</h2>
        <p>
          {t('privacy.s6_body_pre')}{' '}
          <a href="https://plausible.io">Plausible Analytics</a>
          {t('privacy.s6_body_post')}
        </p>
        <p>{t('privacy.s6_body2')}</p>

        <h2>{t('privacy.s7_title')}</h2>
        <p>{t('privacy.s7_body')}</p>

        <h2>{t('privacy.s8_title')}</h2>
        <p>{t('privacy.s8_lead')}</p>
        <ul>
          <li>{t('privacy.s8_item1')}</li>
          <li>{t('privacy.s8_item2')}</li>
        </ul>

        <h2>{t('privacy.s9_title')}</h2>
        <p>{t('privacy.s9_body')}</p>

        <h2>{t('privacy.s10_title')}</h2>
        <p>{t('privacy.s10_body')}</p>

        <h2>{t('privacy.s11_title')}</h2>
        <p>
          {t('privacy.s11_body')}{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </div>
  );
}
