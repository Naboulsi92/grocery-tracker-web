'use client';

import { useEffect, useState } from 'react';
import { useOfflineQueueStatus } from '@/hooks/useOfflineQueueStatus';
import { startOfflineQueue, retryFailedActions } from '@/lib/offlineQueue';
import { useI18n } from '@/contexts/LanguageContext';

export function SyncingIndicator() {
  const { pendingCount, isSyncing, hasFailed } = useOfflineQueueStatus();
  const { t } = useI18n();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    startOfflineQueue();
  }, []);

  const showSyncing = isSyncing && pendingCount > 0;

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryFailedActions();
    } finally {
      setRetrying(false);
    }
  }

  if (!showSyncing && !hasFailed) return null;

  return (
    <div className="sync-indicator" role="status" aria-live="polite" data-testid="syncing-indicator">
      {showSyncing && (
        <span className="sync-indicator-text">
          <span className="sync-indicator-dot animate-pulse" aria-hidden="true" />
          {t('sync.in_progress')}
          <span className="sync-indicator-count" data-testid="queue-pending-count">
            {pendingCount}
          </span>
        </span>
      )}
      {hasFailed && (
        <span className="sync-indicator-error">
          <span>{t('sync.failed')}</span>
          <button
            type="button"
            className="sync-indicator-retry"
            onClick={() => void handleRetry()}
            disabled={retrying}
          >
            {retrying ? <span className="spinner" aria-hidden="true" /> : t('sync.retry')}
          </button>
        </span>
      )}
    </div>
  );
}
