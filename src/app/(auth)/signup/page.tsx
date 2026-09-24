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
import { AuthHeader } from '@/components/AuthHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, access, loading: authLoading } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  // Invitation detour (ticket #58): honored on both the auto-redirect and
  // the post-submit push, so a ?next= join URL survives account creation.
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');

  useEffect(() => {
    if (!authLoading && access.status === 'member') {
      router.replace(resolvePostAuthRedirect(nextParam, '/home'));
    } else if (!authLoading && access.status === 'no-household') {
      router.replace(resolvePostAuthRedirect(nextParam, '/join-household'));
    }
  }, [access.status, authLoading, router, nextParam]);

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

    if (password !== confirmPassword) {
      setError(t('signup.password_mismatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('signup.password_too_short'));
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password);

    if (error) {
      setError(mapAuthErrorToKey(error));
      setLoading(false);
    } else {
      router.push(resolvePostAuthRedirect(nextParam, '/join-household'));
    }
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          showBackHome
          title={t('signup.title')}
          subtitle={t('signup.subtitle')}
        />
        
        {error && <ErrorBanner message={translateMessage(language, error)} />}

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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('signup.confirm_password')}</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={8}
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
                {t('signup.submitting')}
              </>
            ) : (
              t('signup.submit')
            )}
          </button>
        </form>

        <p className="auth-footer">
          {t('signup.footer_prompt')}{' '}
          <Link href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}>{t('signup.login_link')}</Link>
        </p>
        </main>
      </div>
    );
  }
