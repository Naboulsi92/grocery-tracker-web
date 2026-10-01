'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { translateMessage } from '@/lib/i18n';
import { mapAuthErrorToKey } from '@/lib/authErrors';
import { buildPasswordResetRedirect, normalizeEmail } from '@/lib/password-reset';
import { providerDisplayName, type AuthProvider } from '@/lib/auth-provider';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { AuthHeader, BackHomeLink } from '@/components/AuthHeader';
import { ErrorBanner } from '@/components/ErrorBanner';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}

function ForgotPasswordPageInner() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [oauthProvider, setOauthProvider] = useState<AuthProvider | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { requestPasswordReset } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const [supabase] = useState(createClient);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      return;
    }
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown > 0]);

  if (!isOnline) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <OfflineBlockedScreen />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setError('');
    setLoading(true);

    const normalized = normalizeEmail(email);

    // Ticket #164, décision 1 : un email inconnu n'envoie rien et affiche une
    // erreur explicite (pas d'enumeration-safe). Disclosure volontaire et
    // étroite : la fonction ne retourne qu'un booléen (contrat sécurité).
    const { data: exists, error: existsError } = await supabase.rpc('email_exists', {
      p_email: normalized,
    });
    if (existsError) {
      setError(mapAuthErrorToKey(existsError));
      setLoading(false);
      return;
    }
    if (!exists) {
      setError('errors.auth.unknown_email');
      setLoading(false);
      return;
    }

    // Ticket #166, PRD email-only : un compte provider n'a pas de mot de
    // passe à réinitialiser — notice explicative au lieu de l'envoi (qui
    // ajouterait par effet de bord une identité email au compte OAuth).
    const { data: provider, error: providerError } = await supabase.rpc(
      'auth_provider_for_email',
      { p_email: normalized }
    );
    if (providerError) {
      setError(mapAuthErrorToKey(providerError));
      setLoading(false);
      return;
    }
    if (provider === 'google' || provider === 'apple') {
      setOauthProvider(provider);
      setLoading(false);
      return;
    }

    // Ticket #169 : same localhost trap as OAuth — window.location.origin is
    // the only host that is always right client-side (see OAuthButtons).
    const { error } = await requestPasswordReset(
      normalized,
      buildPasswordResetRedirect(window.location.origin)
    );
    setLoading(false);

    if (error) {
      setError(mapAuthErrorToKey(error));
      return;
    }
    setSent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  const backToLogin = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login';

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <BackHomeLink />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          title={t('forgot.title')}
          subtitle={t('forgot.subtitle')}
        />

        {error && <ErrorBanner message={translateMessage(language, error)} />}

        {oauthProvider ? (
          <div data-testid="forgot-oauth-notice">
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              {t('forgot.oauth_notice', { provider: providerDisplayName(oauthProvider) })}
            </p>
            <Link href={backToLogin} className="btn btn-secondary">
              {t('forgot.back_to_login')}
            </Link>
          </div>
        ) : sent ? (
          <div data-testid="forgot-success">
            <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{t('forgot.success_title')}</h2>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>{t('forgot.success_message')}</p>
            <Link href={backToLogin} className="btn btn-secondary">
              {t('forgot.back_to_login')}
            </Link>
          </div>
        ) : (
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
                data-testid="forgot-email-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="btn btn-primary auth-submit"
              data-testid="forgot-submit-button"
            >
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true"></span>
                  {t('forgot.submitting')}
                </>
              ) : cooldown > 0 ? (
                t('forgot.resend_cooldown', { seconds: cooldown })
              ) : (
                t('forgot.submit')
              )}
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link href={backToLogin}>{t('forgot.back_to_login')}</Link>
        </p>
      </main>
    </div>
  );
}
