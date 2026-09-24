'use client';

import { useI18n } from '@/contexts/LanguageContext';

/** Route loading state (ticket #122): skeleton rows instead of a full spinner. */
export default function Loading() {
  const { t } = useI18n();

  return (
    <div className="page-container">
      <main id="main" className="app-main" aria-busy="true">
        <div className="skeleton skeleton-heading" aria-hidden="true" />
        <div className="skeleton skeleton-row" aria-hidden="true" />
        <div className="skeleton skeleton-row" aria-hidden="true" />
        <div className="skeleton skeleton-row" aria-hidden="true" />
        <span className="sr-only" role="status">
          {t('common.loading')}
        </span>
      </main>
    </div>
  );
}
