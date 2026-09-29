'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/LanguageContext';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import { buildOAuthCallbackUrl, stashOAuthNext } from '@/lib/oauth-redirect';
import { getSiteUrl } from '@/lib/site-url';

type OAuthProvider = 'google' | 'apple';

interface OAuthButtonsProps {
  nextParam: string | null;
  signInWithProvider: (provider: OAuthProvider, redirectTo: string) => Promise<{ error: Error | null }>;
  onError: (key: string) => void;
}

/**
 * Shared provider buttons (ticket #166, PRD §3). Rendered above the email
 * form on both login and signup. Providers first is the convention; the
 * email form below stays untouched. Tested in oauth-buttons.test.tsx.
 */
export function OAuthButtons({ nextParam, signInWithProvider, onError }: OAuthButtonsProps) {
  const { t } = useI18n();
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  const start = async (provider: OAuthProvider) => {
    if (pending) return;
    setPending(provider);
    try {
      // Stash first: same-tab sessionStorage survives the provider
      // round-trip even if GoTrue drops ?next= (proven fragile).
      stashOAuthNext(nextParam);
      const { error } = await signInWithProvider(
        provider,
        buildOAuthCallbackUrl(getSiteUrl(), nextParam)
      );
      if (error) {
        onError(mapAuthErrorToKey(error));
        setPending(null);
      }
      // Success navigates away (provider) — no setPending(null) needed.
    } catch {
      onError('errors.auth.oauth_failed');
      setPending(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={() => void start('google')}
        disabled={pending !== null}
        className="btn btn-secondary"
        data-testid="oauth-google-button"
        aria-label={t('oauth.continue_google')}
        style={{ background: '#fff', color: '#1f2937', border: '1px solid var(--color-border)' }}
      >
        {pending === 'google' ? (
          <span className="spinner" aria-hidden="true"></span>
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a7.16 7.16 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
        )}
        {pending === 'google' ? t('oauth.initiating') : t('oauth.continue_google')}
      </button>
      <button
        type="button"
        onClick={() => void start('apple')}
        disabled={pending !== null}
        className="btn btn-secondary"
        data-testid="oauth-apple-button"
        aria-label={t('oauth.continue_apple')}
        style={{ background: '#000', color: '#fff', border: '1px solid #000' }}
      >
        {pending === 'apple' ? (
          <span className="spinner" aria-hidden="true"></span>
        ) : (
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.98-.2 1.92-.87 3.03-.83 1.32.11 2.31.63 2.96 1.57-2.71 1.63-2.26 5.21.45 6.21-.5 1.28-1.14 2.55-2.52 3.22zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        )}
        {pending === 'apple' ? t('oauth.initiating') : t('oauth.continue_apple')}
      </button>
      <div className="divider"><span>{t('oauth.divider')}</span></div>
    </div>
  );
}
