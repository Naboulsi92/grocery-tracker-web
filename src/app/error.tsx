'use client';

import { useEffect } from 'react';
import { useI18n } from '@/contexts/LanguageContext';

/**
 * Route segment error boundary (ticket #122): translated message + retry.
 * Rendered by Next.js when a route throws; reset() retries the segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Logged for debugging (Error objects only, never secrets).
    console.error(error);
  }, [error]);

  return (
    <div className="page-container">
      <main id="main" className="app-main">
        <div className="empty-state" role="alert">
          <h1>{t('errors.app.title')}</h1>
          <p className="text-muted">{t('errors.app.message')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => reset()}
            data-testid="error-boundary-retry"
          >
            {t('common.retry')}
          </button>
        </div>
      </main>
    </div>
  );
}
