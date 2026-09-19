'use client';

import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';
import { useI18n } from '@/contexts/LanguageContext';

export function CTA() {
  const { t } = useI18n();
  return (
    <section id="cta" className="mk-cta-section">
      <div className="mk-container">
        {/* an enlarged echo of the auth card: joining looks like the
            signup page */}
        <div className="mk-cta-card">
          <div className="mk-cta-tile" aria-hidden="true">
            <BrandIcon size={32} />
          </div>
          <h2>{t('mk.cta_h2')}</h2>
          <p>
            {t('mk.cta_sub')}
          </p>
          <Link href="/signup" data-cta-name="Bottom_GetStarted" className="mk-btn-primary">
            {t('mk.cta_button')}
          </Link>
          <p className="mk-cta-note">{t('mk.cta_note')}</p>
        </div>
      </div>
    </section>
  );
}
