'use client';

import { useI18n } from '@/contexts/LanguageContext';

/** Route loading state (ticket #122): skeleton cards instead of a full spinner. */
export default function Loading() {
  const { t } = useI18n();

  return (
    <div className="page-container">
      <main id="main" className="app-main" aria-busy="true">
        <div className="skeleton skeleton-heading" aria-hidden="true" />
        <div className="dashboard-grid">
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
          <div className="skeleton skeleton-card" aria-hidden="true" />
        </div>
        <span className="sr-only" role="status">
          {t('common.loading')}
        </span>
      </main>
    </div>
  );
}
