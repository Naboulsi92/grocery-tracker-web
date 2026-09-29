'use client';

import { useSearchParams } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';
import { useI18n } from '@/contexts/LanguageContext';

export function SessionErrorBanner() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const sessionError = searchParams.get('error');

  if (sessionError === 'session_refresh_failed') {
    return (
      <ErrorBanner message={t('session.expired')} />
    );
  }

  // Ticket #166 : OAuth round-trip failures land here from the callback
  // (?error= + preserved ?next=). Distinct cancelled vs failed messages.
  if (sessionError === 'oauth_cancelled') {
    return (
      <ErrorBanner message={t('errors.auth.oauth_cancelled')} />
    );
  }

  if (sessionError === 'oauth_failed') {
    return (
      <ErrorBanner message={t('errors.auth.oauth_failed')} />
    );
  }

  return null;
}