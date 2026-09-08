'use client';

import { useSearchParams } from 'next/navigation';
import { ErrorBanner } from '@/components/ErrorBanner';

export function SessionErrorBanner() {
  const searchParams = useSearchParams();
  const sessionError = searchParams.get('error');

  if (sessionError !== 'session_refresh_failed') {
    return null;
  }

  return (
    <ErrorBanner message="Votre session a expiré. Veuillez vous reconnecter." />
  );
}