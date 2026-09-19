'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/LanguageContext';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { t } = useI18n();

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="mk-section" id="faq">
      <div className="mk-container mk-faq">
        <h2 className="mk-h2">{t('mk.faq_h2')}</h2>
        <p className="mk-section-sub">
          {t('mk.faq_sub')}
        </p>
        <div className="mk-faq-list">
          {[1, 2, 3, 4, 5].map((n, index) => {
            const questionKey = `mk.faq_${n}_q` as const;
            const answerKey = `mk.faq_${n}_a` as const;
            return (
              <div key={index} className="mk-faq-item">
                <button
                  onClick={() => toggleFaq(index)}
                  className="mk-faq-q"
                  aria-expanded={openIndex === index}
                >
                  <span>{t(questionKey)}</span>
                  <svg
                    className="mk-faq-chevron"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="mk-faq-a">
                    {t(answerKey)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
