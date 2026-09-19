'use client';

import { useI18n } from '@/contexts/LanguageContext';

export function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    {
      number: 1,
      title: t('mk.how_1_title'),
      description: t('mk.how_1_desc'),
    },
    {
      number: 2,
      title: t('mk.how_2_title'),
      description: t('mk.how_2_desc'),
    },
    {
      number: 3,
      title: t('mk.how_3_title'),
      description: t('mk.how_3_desc'),
    },
    {
      number: 4,
      title: t('mk.how_4_title'),
      description: t('mk.how_4_desc'),
    },
  ];

  return (
    <section className="mk-section mk-section-tinted" id="how-it-works">
      <div className="mk-container">
        <h2 className="mk-h2">{t('mk.how_h2')}</h2>
        <p className="mk-section-sub">
          {t('mk.how_sub')}
        </p>
        <div className="mk-steps">
          {steps.map((step) => (
            <div key={step.number} className="mk-step">
              <div className="mk-step-num" aria-hidden="true">
                {step.number}
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
