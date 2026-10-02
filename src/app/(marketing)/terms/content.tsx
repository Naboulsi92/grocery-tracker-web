'use client';

import { useI18n } from '@/contexts/LanguageContext';

const SUPPORT_EMAIL = 'grocerytrackersupport@gmail.com';

const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export function TermsContent() {
  const { t } = useI18n();

  return (
    <div className="mk-legal">
      <div className="mk-legal-inner mk-legal-inner--with-toc">
        <h1>{t('terms.title')}</h1>
        <p className="mk-legal-date">{t('terms.updated')}</p>

        <div className="mk-legal-layout">
          <nav className="mk-legal-toc" aria-label={t('terms.toc')}>
            <p className="mk-legal-toc-title">{t('terms.toc')}</p>
            <ol>
              {SECTIONS.map((n) => (
                <li key={n}>
                  <a href={`#terms-s${n}`}>{t(`terms.s${n}_title`)}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div>
            <p className="mk-legal-lede">{t('terms.intro')}</p>

            <h2 id="terms-s1">{t('terms.s1_title')}</h2>
            <p>{t('terms.s1_body')}</p>

            <h2 id="terms-s2">{t('terms.s2_title')}</h2>
            <p>{t('terms.s2_body')}</p>

            <h2 id="terms-s3">{t('terms.s3_title')}</h2>
            <p>{t('terms.s3_lead')}</p>
            <ul>
              <li>{t('terms.s3_item1')}</li>
              <li>{t('terms.s3_item2')}</li>
              <li>{t('terms.s3_item3')}</li>
              <li>{t('terms.s3_item4')}</li>
              <li>{t('terms.s3_item5')}</li>
            </ul>

            <h2 id="terms-s4">{t('terms.s4_title')}</h2>
            <p>{t('terms.s4_body')}</p>

            <h2 id="terms-s5">{t('terms.s5_title')}</h2>
            <p>{t('terms.s5_body')}</p>

            <h2 id="terms-s6">{t('terms.s6_title')}</h2>
            <p>
              {t('terms.s6_body_pre')}{' '}
              <a href="/privacy">{t('terms.s6_link')}</a>
              {t('terms.s6_body_post')}
            </p>

            <h2 id="terms-s7">{t('terms.s7_title')}</h2>
            <p>{t('terms.s7_body')}</p>

            <h2 id="terms-s8">{t('terms.s8_title')}</h2>
            <p>{t('terms.s8_body')}</p>

            <h2 id="terms-s9">{t('terms.s9_title')}</h2>
            <p>{t('terms.s9_body')}</p>

            <h2 id="terms-s10">{t('terms.s10_title')}</h2>
            <p>{t('terms.s10_body')}</p>

            <h2 id="terms-s11">{t('terms.s11_title')}</h2>
            <p>
              {t('terms.s11_body')}{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
