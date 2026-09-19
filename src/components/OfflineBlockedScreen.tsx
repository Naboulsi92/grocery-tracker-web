'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useI18n } from '@/contexts/LanguageContext';

export function OfflineBlockedScreen() {
  const { isOnline } = useOnlineStatus();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div className="offline-blocked-screen" role="alert" data-testid="offline-blocked-screen">
      <p className="offline-blocked-title">{t('offline.title')}</p>
      <p className="offline-blocked-subtitle">{t('offline.subtitle')}</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => window.location.reload()}
        data-testid="offline-retry-button"
      >
        {t('offline.retry')}
      </button>
    </div>
  );
}