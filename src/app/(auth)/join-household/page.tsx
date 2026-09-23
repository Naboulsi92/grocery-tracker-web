'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { householdActionError, normalizeInvitationToken } from '@/lib/household';
import { translateMessage } from '@/lib/i18n';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { AuthHeader } from '@/components/AuthHeader';
import { OfflineBlockedScreen } from '@/components/OfflineBlockedScreen';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { validateName } from '@/lib/validation';
import { updateName, validateFirstName, validateLastName } from '@/lib/account';

type PendingAction = 'create' | 'join' | null;

export default function JoinHouseholdPage() {
  return (
    <Suspense fallback={null}>
      <JoinHouseholdPageInner />
    </Suspense>
  );
}

function JoinHouseholdPageInner() {
  const [householdName, setHouseholdName] = useState('');
  const [householdNameError, setHouseholdNameError] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { access, retryHousehold, user } = useAuth();
  const { t, language } = useI18n();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(createClient);

  // Lockout is enforced server-side (consume_household_invitation blocks an
  // invitation after 5 failed attempts for 1 minute and raises P0001).
  // The client only mirrors the remaining window while the button stays usable
  // for genuinely unknown tokens (those don't count toward the lockout).
  const isLockedOut = lockoutSeconds > 0;

  // Deep-link prefill: /join-household?code=... or ?invite=... (shared invite QR)
  const [invitationToken, setInvitationToken] = useState(
    () => searchParams.get('code') ?? searchParams.get('invite') ?? '',
  );

  useEffect(() => {
    if (access.status === 'anonymous') router.replace('/login');
    if (access.status === 'member') router.replace('/home');
  }, [access.status, router]);

  useEffect(() => {
    if (lockoutSeconds <= 0) {
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
        lockoutTimerRef.current = null;
      }
      return;
    }
    lockoutTimerRef.current = setInterval(() => {
      setLockoutSeconds((prev) => prev - 1);
    }, 1000);
    return () => {
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
        lockoutTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLockedOut]);

  const finishOnboarding = useCallback(() => {
    retryHousehold();
    router.replace('/home');
  }, [retryHousehold, router]);

  const persistNames = useCallback(async (): Promise<boolean> => {
    const firstNameValidationError = validateFirstName(firstName);
    const lastNameValidationError = validateLastName(lastName);
    if (firstNameValidationError) {
      setFirstNameError(firstNameValidationError);
      return false;
    }
    if (lastNameValidationError) {
      setLastNameError(lastNameValidationError);
      return false;
    }
    if (!user) return false;
    setFirstNameError('');
    setLastNameError('');
    const { error: nameError } = await updateName(supabase, user.id, firstName, lastName);
    if (nameError) {
      setError(nameError);
      return false;
    }
    return true;
  }, [firstName, lastName, supabase, user]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setHouseholdNameError('');
    setPendingAction('create');

    const nameToSubmit = householdName.trim() || 'Mon Foyer';
    if (householdName.trim()) {
      const nameErr = validateName(householdName);
      if (nameErr) { setHouseholdNameError(nameErr); setPendingAction(null); return; }
    }

    const persisted = await persistNames();
    if (!persisted) { setPendingAction(null); return; }

    const { error: createError } = await supabase.rpc('create_household', {
      p_name: nameToSubmit,
    });

    if (createError) {
      setError(householdActionError('create', createError));
      setPendingAction(null);
      return;
    }

    finishOnboarding();
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setPendingAction('join');

    const persisted = await persistNames();
    if (!persisted) { setPendingAction(null); return; }

    const token = normalizeInvitationToken(invitationToken);
    const { error: joinError } = await supabase.rpc('consume_household_invitation', { p_token: token });

    if (joinError) {
      setError(householdActionError('join', joinError));
      setPendingAction(null);
      // Server raised the lockout (P0001): mirror its 1-minute window.
      if (joinError.code === 'P0001') {
        setLockoutSeconds(60);
      }
      return;
    }

    finishOnboarding();
  };

  if (!isOnline) {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <OfflineBlockedScreen />
      </div>
    );
  }

  if (access.status === 'loading' || access.status === 'member' || access.status === 'anonymous') {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <LanguageToggle />
        <main id="main" className="auth-card">
          <div className="loading-container" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>{t('common.loading')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
      <div className="auth-container">
      <ThemeToggle />
      <LanguageToggle />
      <main id="main" className="auth-card animate-fade-in">
        <AuthHeader
          showBackHome
          showSignOut
          title={t('join.title')}
          subtitle={t('join.subtitle')}
        />

        {access.status === 'error' && (
          <div className="auth-error" role="alert">
            {t('join.verify_error')}
            <button type="button" className="btn btn-secondary" onClick={retryHousehold}>{t('common.retry')}</button>
          </div>
        )}

        {error && (
          <div className="auth-error" role="alert" data-testid="invite-code-error">
            {translateMessage(language, error)}
          </div>
        )}

        {isLockedOut && (
          <div className="auth-error" role="alert" data-testid="invite-code-locked-message">
            {t('join.lockout', { seconds: lockoutSeconds })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section aria-labelledby="profile-names-title">
            <h2 id="profile-names-title" style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>{t('join.names_title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="onboarding-first-name">{t('join.first_name_label')}</label>
                <input
                  id="onboarding-first-name"
                  type="text"
                  placeholder={t('join.first_name_label')}
                  data-testid="onboarding-first-name-input"
                  value={firstName}
                  onChange={(event) => { setFirstName(event.target.value); setFirstNameError(''); }}
                  maxLength={50}
                  autoComplete="given-name"
                  required
                  disabled={pendingAction !== null}
                  aria-invalid={!!firstNameError}
                  aria-describedby={firstNameError ? 'onboarding-first-name-error' : undefined}
                />
                {firstNameError && <p className="field-error" role="alert" id="onboarding-first-name-error" data-testid={firstNameError === 'validation.first_name.too_long' ? 'error-onboarding-first-name-too-long' : 'error-onboarding-first-name-required-letter'}>{t(firstNameError)}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="onboarding-last-name">{t('join.last_name_label')}</label>
                <input
                  id="onboarding-last-name"
                  type="text"
                  placeholder={t('join.last_name_label')}
                  data-testid="onboarding-last-name-input"
                  value={lastName}
                  onChange={(event) => { setLastName(event.target.value); setLastNameError(''); }}
                  maxLength={50}
                  autoComplete="family-name"
                  required
                  disabled={pendingAction !== null}
                  aria-invalid={!!lastNameError}
                  aria-describedby={lastNameError ? 'onboarding-last-name-error' : undefined}
                />
                {lastNameError && <p className="field-error" role="alert" id="onboarding-last-name-error" data-testid={lastNameError === 'validation.last_name.too_long' ? 'error-onboarding-last-name-too-long' : 'error-onboarding-last-name-required-letter'}>{t(lastNameError)}</p>}
              </div>
            </div>
          </section>

          <section aria-labelledby="create-household-title">
            <h2 id="create-household-title" style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>{t('join.create_title')}</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label htmlFor="household-name">{t('join.create_name_label')}</label>
              <input
                id="household-name"
                type="text"
                placeholder={t('join.create_name_placeholder')}
                value={householdName}
                onChange={(event) => { setHouseholdName(event.target.value); setHouseholdNameError(''); }}
                disabled={pendingAction !== null}
                  aria-invalid={!!householdNameError}
                  aria-describedby={householdNameError ? 'household-name-error' : undefined}
              />
              {householdNameError && <p className="field-error" role="alert" id="household-name-error" data-testid={householdNameError === 'validation.name.too_long' ? 'error-name-too-long' : 'error-name-required-letter'}>{t(householdNameError)}</p>}
              <button type="submit" disabled={pendingAction !== null} className="btn btn-primary" style={{ background: 'var(--color-accent)' }}>
                {pendingAction === 'create' ? t('join.creating') : t('join.create_submit')}
              </button>
            </form>
          </section>

          <div className="divider"><span>{t('join.or')}</span></div>

          <section aria-labelledby="join-household-title">
            <h2 id="join-household-title" style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>{t('join.join_title')}</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label htmlFor="invitation-token">{t('join.join_token_label')}</label>
              <input
                id="invitation-token"
                type="text"
                placeholder={t('join.join_token_placeholder')}
                value={invitationToken}
                onChange={(event) => setInvitationToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={pendingAction !== null || isLockedOut}
                required
                data-testid="invite-token-input"
              />
              <button type="submit" disabled={pendingAction !== null || isLockedOut} className="btn btn-primary">
                {pendingAction === 'join' ? t('join.joining') : t('join.join_submit')}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
