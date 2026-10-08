'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { translateMessage } from '@/lib/i18n';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import { getAuthProvider } from '@/lib/auth-provider';
import { validateNewPassword } from '@/lib/account';
import { isPasswordBreached } from '@/lib/passwordBreach';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { AuthHeader, BackHomeLink } from '@/components/AuthHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}

function ResetPasswordPageInner() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [succeeded, setSucceeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirectPending, setRedirectPending] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isProviderAccount, setIsProviderAccount] = useState(false);
  const { access, updateRecoveryPassword, signOut } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get('error');
  const [supabase] = useState(createClient);

  // A recovery session is required: without one (direct visit, expired or
  // already-used link) show the expired state with a retry path — never a
  // dead end. Deliberately no auto-redirect away: this page must not bounce
  // authenticated users (the recovery session IS authenticated).
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(data.session !== null);
      // Ticket #166, belt-and-braces : un compte provider ne devrait jamais
      // détenir de session de récupération — sans formulaire dans ce cas.
      setIsProviderAccount(getAuthProvider(data.session?.user ?? null) !== 'email');
      setSessionChecked(true);
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  // Déterministe et sans race : le push vers /login n'a lieu qu'une fois
  // l'état anonymous observé (pousser tant que `user` est résolu rebondirait
  // vers /home via l'auto-redirect du login).
  useEffect(() => {
    if (redirectPending && access.status === 'anonymous') {
      router.push('/login');
    }
  }, [redirectPending, access.status, router]);

  if (!isOnline) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <OfflineBlockedScreen />
      </div>
    );
  }

  if (!sessionChecked) {
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

  if (callbackError || !hasSession || isProviderAccount) {
    return (
      <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <BackHomeLink />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          title={t('reset.expired_title')}
            subtitle={t('reset.expired_message')}
          />
          <Link
            href="/forgot-password"
            className="btn btn-primary"
            data-testid="reset-request-new-link"
          >
            {t('reset.request_new_link')}
          </Link>
        </main>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('reset.password_mismatch');
      return;
    }
    const passwordError = validateNewPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    // Leaked-password protection (HIBP k-anonymity): after local
    // validations, before the recovery update.
    if (await isPasswordBreached(password)) {
      setError('validation.password.leaked');
      setLoading(false);
      return;
    }

    const { error } = await updateRecoveryPassword(password);
    setLoading(false);

    if (error) {
      setError(mapAuthErrorToKey(error));
      return;
    }
    setSucceeded(true);
    // Le push attend l'état anonymous (effet dédié ci-dessus) : pousser tant
    // que `user` est encore résolu rebondirait vers /home. Déterministe,
    // sans race.
    await signOut();
    setRedirectPending(true);
  };

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <BackHomeLink />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          title={t('reset.title')}
          subtitle={t('reset.subtitle')}
        />

        {error && <ErrorBanner message={translateMessage(language, error)} />}
        {succeeded && <p role="status">{t('reset.success')}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="new-password">{t('reset.new_password')}</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              data-testid="reset-new-password-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">{t('reset.confirm_password')}</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              data-testid="reset-confirm-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading || succeeded}
            className="btn btn-primary auth-submit"
            data-testid="reset-submit-button"
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                {t('reset.submitting')}
              </>
            ) : (
              t('reset.submit')
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
