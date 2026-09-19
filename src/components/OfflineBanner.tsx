'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useI18n } from '@/contexts/LanguageContext';

export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const { t } = useI18n();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="status" data-testid="offline-banner">
      {t('offline.banner')}
    </div>
  );
}