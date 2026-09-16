'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { translateMessage } from '@/lib/i18n';
import { useTheme } from '@/contexts/ThemeContext';
import { useHousehold } from '@/hooks/useHousehold';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { createClient } from '@/utils/supabase/client';
import {
  changePassword,
  fetchProfile,
  requestAccountDeletion,
  restoreAccountIfPending,
  updateDisplayName,
  updateProfileLanguage,
  validateDisplayName,
  validateNewPassword,
  type ProfileLanguage,
} from '@/lib/account';

export default function AccountPage() {
  const { user, householdId, signOut } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId || '', { language });
  const { theme, toggleTheme } = useTheme();
  const [supabase] = useState(createClient);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  const [profileLanguage, setProfileLanguage] = useState<ProfileLanguage>('fr');
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState('');

  const [restoredAccount, setRestoredAccount] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Restore-on-login is wired here for now: AuthContext is outside this ticket's
  // file ownership, so signing in again within the 7-day retention window is only
  // reconciled once the user opens /account. A future pass should move the restore
  // call into AuthContext's session resolution so any signed-in user is restored.
  useEffect(() => {
    let active = true;
    const userId = user?.id;
    if (!userId) return;
    const signedInUserId: string = userId;

    async function loadAndMaybeRestore() {
      const { profile, error } = await fetchProfile(supabase, signedInUserId);
      if (!active) return;
      if (error) {
        setProfileError(error);
        setProfileLoading(false);
        return;
      }
      if (profile) {
        setDisplayName(profile.display_name ?? '');
        setProfileLanguage(profile.language === 'en' ? 'en' : 'fr');

        if (profile.deleted_at) {
          const { restored, error: restoreError } = await restoreAccountIfPending(supabase, signedInUserId);
          if (!active) return;
          if (restored) {
            setRestoredAccount(true);
          } else if (restoreError) {
            setProfileError(restoreError);
          }
        }
      }
      setProfileLoading(false);
    }

    void loadAndMaybeRestore();
    return () => {
      active = false;
    };
  }, [user?.id, supabase]);

  const handleSaveName = async () => {
    if (!user || !supabase) return;
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setDisplayNameError(validationError);
      return;
    }
    setDisplayNameError('');
    setDisplayNameSaved(false);
    setDisplayNameSaving(true);
    const { error } = await updateDisplayName(supabase, user.id, displayName);
    setDisplayNameSaving(false);
    if (error) {
      setDisplayNameError(error);
      return;
    }
    setDisplayNameSaved(true);
  };

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!user) return;
    const next = event.target.value as ProfileLanguage;
    setLanguageError('');
    setLanguageSaving(true);
    const { error } = await updateProfileLanguage(supabase, user.id, next);
    setLanguageSaving(false);
    if (error) {
      setLanguageError(error);
      return;
    }
    setProfileLanguage(next);
    setLanguage(next, { persist: false });
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    setPasswordError('');
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('account.password_mismatch');
      return;
    }
    const validationError = validateNewPassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }
    setPasswordSaving(true);
    const { error } = await changePassword(supabase, user.email, currentPassword, newPassword);
    setPasswordSaving(false);
    if (error) {
      setPasswordError(error);
      return;
    }
    setPasswordSaved(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await requestAccountDeletion(supabase, user.id);
    if (error) {
      setDeleteError(error);
      setDeleting(false);
      return;
    }
    // Soft-delete recorded (7-day retention, permanent deletion is a later
    // server-side ticket); AuthContext transitions the private route to /login.
    await signOut();
  };

  if (profileLoading || householdLoading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <ThemeToggle />
      <AuthenticatedHeader
        showBackLink
        household={household}
        loading={householdLoading}
        error={householdError}
      />

      <main className="app-main">
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>{t('account.title')}</h2>

        {restoredAccount && (
          <p className="account-feedback-success" role="status">
            {t('account.restored')}
          </p>
        )}
        {profileError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1rem' }}>{translateMessage(language, profileError)}</div>
        )}

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.display_name_section')}</h2>
          <div className="form-group">
            <label htmlFor="account-display-name">{t('account.display_name_section')}</label>
            <input
              id="account-display-name"
              type="text"
              data-testid="account-display-name-input"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setDisplayNameError('');
                setDisplayNameSaved(false);
              }}
              maxLength={50}
              autoComplete="name"
              aria-invalid={!!displayNameError}
              aria-describedby="account-name-error"
            />
          </div>
          {displayNameError && <p className="notification-error field-error" role="alert" id="account-name-error" data-testid={displayNameError === 'validation.display_name.too_long' ? 'error-name-too-long' : 'error-name-required-letter'}>{translateMessage(language, displayNameError)}</p>}
          {displayNameSaved && (
            <p className="account-feedback-success" role="status">{t('account.name_saved')}</p>
          )}
          <button
            type="button"
            data-testid="account-save-button"
            className="btn btn-primary account-section-action"
            onClick={() => void handleSaveName()}
            disabled={displayNameSaving}
          >
            {displayNameSaving ? t('account.saving') : t('account.save')}
          </button>
        </section>

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.language_section')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.language_hint')}
          </p>
          <div className="form-group">
            <label htmlFor="account-language">{t('account.language_label')}</label>
            <select
              id="account-language"
              data-testid="account-language-selector"
              value={profileLanguage}
              onChange={(event) => void handleLanguageChange(event)}
              disabled={languageSaving}
            >
              <option value="fr">{t('account.language_fr')}</option>
              <option value="en">{t('account.language_en')}</option>
            </select>
          </div>
          {languageError && <p className="notification-error" role="alert">{translateMessage(language, languageError)}</p>}
          {languageSaving && <p className="text-sm text-muted">{t('account.saving')}</p>}
        </section>

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.appearance_section')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.appearance_hint')}
          </p>
          <button
            type="button"
            data-testid="account-dark-mode-toggle"
            className="btn btn-secondary"
            onClick={toggleTheme}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? t('account.dark_mode') : t('account.light_mode')}
          </button>
        </section>

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.password_section')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.password_hint')}
          </p>
          <form onSubmit={(event) => void handleChangePassword(event)} className="auth-form">
            <div className="form-group">
              <label htmlFor="account-current-password">{t('account.current_password')}</label>
              <input
                id="account-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="account-new-password">{t('account.new_password')}</label>
              <input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="account-confirm-password">{t('account.confirm_new_password')}</label>
              <input
                id="account-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {passwordError && <p className="notification-error" role="alert">{translateMessage(language, passwordError)}</p>}
            {passwordSaved && (
              <p className="account-feedback-success" role="status">{t('account.password_changed')}</p>
            )}
            <button
              type="submit"
              data-testid="account-change-password-button"
              className="btn btn-secondary"
              disabled={passwordSaving}
            >
              {passwordSaving ? t('account.changing') : t('account.change_password')}
            </button>
          </form>
        </section>

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.session_section')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.session_hint')}
          </p>
          <button
            type="button"
            data-testid="account-sign-out-button"
            className="btn btn-ghost"
            onClick={() => void handleSignOut()}
          >
            {t('auth.sign_out')}
          </button>
        </section>

        <section className="card account-section" style={{ borderColor: 'var(--color-danger)' }}>
          <h2 className="account-section-title">{t('account.danger_zone')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.danger_hint')}
          </p>
          {deleteError && <p className="notification-error" role="alert">{translateMessage(language, deleteError)}</p>}
          <button
            type="button"
            data-testid="account-delete-button"
            className="btn btn-danger"
            onClick={() => {
              setDeleteError('');
              setShowDeleteConfirm(true);
            }}
          >
            {t('account.delete_account')}
          </button>
        </section>
      </main>

      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-delete-dialog-title"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h3 id="account-delete-dialog-title">{t('account.delete_title')}</h3>
            <p className="text-muted" style={{ margin: '0.75rem 0 1.5rem' }}>
              {t('account.delete_hint')}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                data-testid="account-delete-confirm"
                className="btn btn-danger"
                onClick={() => void handleDeleteAccount()}
                disabled={deleting}
              >
                {deleting ? t('account.deleting') : t('account.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1rem;
        }
        .modal-content {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }
        .modal-content h3 {
          font-size: 1.125rem;
        }
        .btn-danger {
          background: var(--color-danger);
          color: #fff;
        }
        .btn-danger:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}