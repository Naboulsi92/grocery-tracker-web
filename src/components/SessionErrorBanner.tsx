'use client';

import { useSearchParams } from 'next/navigation';

export function SessionErrorBanner() {
  const searchParams = useSearchParams();
  const sessionError = searchParams.get('error');

  if (sessionError !== 'session_refresh_failed') {
    return null;
  }

  return (
    <div className="auth-error" role="alert">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Votre session a expiré. Veuillez vous reconnecter.
    </div>
  );
}