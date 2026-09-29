'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useI18n } from '@/contexts/LanguageContext';
import { resolveResetRedirect } from '@/lib/password-reset';
import { takeOAuthNext } from '@/lib/oauth-redirect';
import { isSafeNextPath } from '@/lib/invite-detour';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

/**
 * Auth callback (tickets #164 + #166). Client page on purpose: depending on
 * project and link shape, GoTrue delivers the recovery session as ?code=
 * (PKCE), #access_token fragment (implicit flow — invisible to any server
 * route), or ?token_hash= passthrough. The browser client consumes the first
 * two itself; only token_hash needs an explicit verifyOtp call. A
 * server-only callback would dead-end the fragment shape (real prod hole).
 *
 * Ticket #166 extends it to OAuth: no token_hash means "provider round-trip"
 * — a present session routes by membership. Deliberately no PKCE migration
 * and no server route (documented deviation, issue #166).
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackPageInner />
    </Suspense>
  );
}

function AuthCallbackPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(createClient);
  const next = resolveResetRedirect(searchParams.get('next'), '/forgot-password');
  // Raw ?next= for the OAuth branch (validated at each use site): the reset
  // redirect above narrows to the reset page, which OAuth must not inherit.
  const oauthNext = searchParams.get('next');

  useEffect(() => {
    let active = true;
    let done = false;
    const finish = (target: string) => {
      if (!active || done) return;
      done = true;
      router.replace(target);
    };
    const failLogin = (error: string) => {
      const login = new URL('/login', window.location.origin);
      login.searchParams.set('error', error);
      if (isSafeNextPath(oauthNext)) login.searchParams.set('next', oauthNext);
      finish(login.pathname + login.search);
    };

    void (async () => {
      try {
        // Provider-side cancellation arrives as ?error= (no code, no session).
        const providerError = searchParams.get('error');
        if (providerError) {
          failLogin(providerError === 'access_denied' ? 'oauth_cancelled' : 'oauth_failed');
          return;
        }
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        if (tokenHash) {
          // Recovery shape: explicit verification, then the reset page.
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (params.get('type') ?? 'recovery') as 'recovery',
          });
          if (error) {
            finish('/forgot-password?error=expired');
            return;
          }
          finish(next);
          return;
        }
        // OAuth shape (?code= or implicit fragment): the browser client
        // consumes both itself — a present session means a valid round-trip.
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          finish('/forgot-password?error=expired');
          return;
        }
        const { data: membership } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', data.session.user.id)
          .maybeSingle();
        if (isSafeNextPath(oauthNext)) {
          finish(oauthNext);
          return;
        }
        const stashed = takeOAuthNext();
        if (stashed) {
          finish(stashed);
          return;
        }
        finish(membership?.household_id ? '/home' : '/join-household');
      } catch {
        finish('/forgot-password?error=expired');
      }
    })();

    // Safety net: never hang on the spinner (offline, unresponsive backend).
    const timeout = setTimeout(() => finish('/forgot-password?error=expired'), 15000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router, next]);

  return (
    <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <div className="auth-card">
        <div className="loading-container" role="status" data-testid="callback-loading">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    </div>
  );
}
