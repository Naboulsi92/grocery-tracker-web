'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/LanguageContext';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import { buildOAuthCallbackUrl, stashOAuthNext } from '@/lib/oauth-redirect';

interface OAuthButtonsProps {
  nextParam: string | null;
  signInWithProvider: (provider: 'google', redirectTo: string) => Promise<{ error: Error | null }>;
  onError: (key: string) => void;
}

/**
 * Provider button (ticket #166). Google only: Sign in with Apple is cut
 * until the paid Developer Program is justified (see issue #166) — the
 * plumbing (provider detection, gating, stash) stays generic for re-adding
 * it later. Rendered above the email form on both login and signup.
 */
export function OAuthButtons({ nextParam, signInWithProvider, onError }: OAuthButtonsProps) {
  const { t } = useI18n();
  const [pending, setPending] = useState(false);

  const start = async () => {
    if (pending) return;
    setPending(true);
    try {
      // Stash first: same-tab sessionStorage survives the provider
      // round-trip even if GoTrue drops ?next= (proven fragile).
      stashOAuthNext(nextParam);
      // Ticket #169 : window.location.origin, never getSiteUrl(). Site URL
      // helpers resolve build-time env (VERCEL_URL is not inlined into the
      // browser bundle, NEXT_PUBLIC_SITE_URL is unset) and fall back to
      // localhost — exactly the prod bug this fixes. The click runs in the
      // browser, so the current origin is always the right host.
      const { error } = await signInWithProvider(
        'google',
        buildOAuthCallbackUrl(window.location.origin, nextParam)
      );
      if (error) {
        onError(mapAuthErrorToKey(error));
        setPending(false);
      }
      // Success navigates away (provider) — no setPending(false) needed.
    } catch {
      onError('errors.auth.oauth_failed');
      setPending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={() => void start()}
        disabled={pending}
        className="btn btn-secondary"
        data-testid="oauth-google-button"
        aria-label={t('oauth.continue_google')}
        style={{ background: '#fff', color: '#1f2937', border: '1px solid var(--color-border)' }}
      >
        {pending ? (
          <span className="spinner" aria-hidden="true"></span>
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a7.16 7.16 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
        )}
        {pending ? t('oauth.initiating') : t('oauth.continue_google')}
      </button>
      <div className="divider"><span>{t('oauth.divider')}</span></div>
    </div>
  );
}
