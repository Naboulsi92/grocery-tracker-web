'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { translateMessage } from '@/lib/i18n';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { AuthHeader } from '@/components/AuthHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { SessionErrorBanner } from '@/components/SessionErrorBanner';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/home');
    }
  }, [user, authLoading, router]);

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
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(mapAuthErrorToKey(error));
      setLoading(false);
    } else {
      router.push('/home');
    }
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          showBackHome
          title={t('login.title')}
          subtitle={t('login.subtitle')}
        />
        
        {error && <ErrorBanner message={translateMessage(language, error)} />}

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
          <Link href="/signup">{t('login.signup_link')}</Link>
        </p>
        </main>
      </div>
    );
  }
