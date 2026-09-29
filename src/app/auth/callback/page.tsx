'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useI18n } from '@/contexts/LanguageContext';
import { resolveResetRedirect } from '@/lib/password-reset';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

/**
 * Auth callback (ticket #164). Client page on purpose: depending on project
 * and link shape, GoTrue delivers the recovery session as ?code= (PKCE),
 * #access_token fragment (implicit flow — invisible to any server route),
 * or ?token_hash= passthrough. The browser client consumes the first two
 * itself; only token_hash needs an explicit verifyOtp call. A server-only
 * callback would dead-end the fragment shape (real prod hole, not just E2E).
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

  useEffect(() => {
    let active = true;
    let done = false;
    const finish = (ok: boolean) => {
      if (!active || done) return;
      done = true;
      router.replace(ok ? next : '/forgot-password?error=expired');
    };

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get('token_hash');
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (params.get('type') ?? 'recovery') as 'recovery',
          });
          finish(!error);
          return;
        }
        const { data } = await supabase.auth.getSession();
        finish(data.session !== null);
      } catch {
        finish(false);
      }
    })();

    // Safety net: never hang on the spinner (offline, unresponsive backend).
    const timeout = setTimeout(() => finish(false), 15000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
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
