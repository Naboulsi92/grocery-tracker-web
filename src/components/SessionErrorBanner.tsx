'use client';

import { useSearchParams } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useI18n } from '@/contexts/LanguageContext';

export function SessionErrorBanner() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const sessionError = searchParams.get('error');

  if (sessionError !== 'session_refresh_failed') {
    return null;
  }

  return (
    <ErrorBanner message={t('session.expired')} />
  );
}