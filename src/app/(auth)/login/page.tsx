'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { translateMessage } from '@/lib/i18n';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import { resolvePostAuthRedirect } from '@/lib/invite-detour';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { AuthHeader, BackHomeLink } from '@/components/AuthHeader';
import { OAuthButtons } from '@/components/OAuthButtons';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SessionErrorBanner } from '@/components/SessionErrorBanner';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const { signIn, signInWithProvider, user, loading: authLoading, resendConfirmationEmail } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  // Invitation detour (ticket #58): ?next= carries the join URL across the
  // auth screens. Single-consumption storage fallback lives in the resolver.
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  useEffect(() => {
    if (!authLoading && user) {
      router.push(resolvePostAuthRedirect(nextParam, '/home'));
    }
  }, [user, authLoading, router, nextParam]);

  if (!isOnline) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <OfflineBlockedScreen />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <div className="auth-card">
          <div className="loading-container" role="status">
            <div className="loading-spinner" aria-hidden="true"></div>
            <p>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationSent(false);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(mapAuthErrorToKey(error));
      setLoading(false);
    } else {
      router.push(resolvePostAuthRedirect(nextParam, '/home'));
    }
  };

  // Ticket #227 : l'email non confirmé bloque côté serveur — proposer le
  // renvoi au lieu de laisser l'utilisateur sans issue.
  const handleResend = async () => {
    setResending(true);
    const { error: resendError } = await resendConfirmationEmail(email);
    setResending(false);
    if (resendError) {
      setError(mapAuthErrorToKey(resendError));
    } else {
      setConfirmationSent(true);
    }
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <BackHomeLink />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          title={t('login.title')}
          subtitle={t('login.subtitle')}
        />

        <OAuthButtons
          nextParam={nextParam}
          signInWithProvider={signInWithProvider}
          onError={setError}
        />

        {error && <ErrorBanner message={translateMessage(language, error)} />}

        {error === 'errors.auth.email_not_confirmed' && !confirmationSent && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={resending}
            onClick={() => void handleResend()}
            data-testid="login-resend-confirmation"
            style={{ marginBottom: '1.5rem', width: '100%' }}
          >
            {t('login.resend_confirmation')}
          </button>
        )}
        {confirmationSent && (
          <p role="status" className="auth-notice" data-testid="login-confirmation-resent">
            {t('login.confirmation_resent')}
          </p>
        )}

        <Suspense fallback={null}>
          <SessionErrorBanner />
        </Suspense>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary auth-submit"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                {t('login.submitting')}
              </>
            ) : (
              t('login.submit')
            )}
          </button>
        </form>

        <p className="auth-footer">
          {t('login.footer_prompt')}{' '}
          <Link href={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : '/signup'}>{t('login.signup_link')}</Link>
        </p>
        <p className="auth-footer">
          <Link href={nextParam ? `/forgot-password?next=${encodeURIComponent(nextParam)}` : '/forgot-password'}>{t('login.forgot_password')}</Link>
        </p>
        </main>
      </div>
    );
  }
