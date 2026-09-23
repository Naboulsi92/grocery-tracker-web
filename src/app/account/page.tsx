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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { createClient } from '@/utils/supabase/client';
import { leaveHousehold } from '@/lib/household';
import {
  changePassword,
  fetchProfile,
  requestAccountDeletion,
  restoreAccountIfPending,
  updateName,
  updateProfileLanguage,
  validateFirstName,
  validateLastName,
  validateNewPassword,
  type ProfileLanguage,
} from '@/lib/account';
import { buildAccountExport, downloadAccountExport } from '@/lib/account-export';

export default function AccountPage() {
  const { user, householdId, signOut } = useAuth();
  const { t, language, setLanguage } = useI18n();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId || '', { language });
  const { theme, toggleTheme } = useTheme();
  const [supabase] = useState(createClient);

  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [nameSaveError, setNameSaveError] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

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

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportDone, setExportDone] = useState(false);

  // PRD §4.9 : reconnexion <7j → deleted_at NULL + compte restauré.
  // Restauration primaire dans AuthContext (toute session) ; ici en fallback
  // pour afficher le bandeau "compte réactivé" sur /account.
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
        setFirstName(profile.first_name ?? '');
        setLastName(profile.last_name ?? '');
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
    const firstNameValidationError = validateFirstName(firstName);
    const lastNameValidationError = validateLastName(lastName);
    if (firstNameValidationError) {
      setFirstNameError(firstNameValidationError);
      return;
    }
    if (lastNameValidationError) {
      setLastNameError(lastNameValidationError);
      return;
    }
    setFirstNameError('');
    setLastNameError('');
    setNameSaveError('');
    setNameSaved(false);
    setNameSaving(true);
    const { error } = await updateName(supabase, user.id, firstName, lastName);
    setNameSaving(false);
    if (error) {
      setNameSaveError(error);
      return;
    }
    setNameSaved(true);
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

  // RGPD §4.11 : export JSON des données personnelles (profil + foyer si
  // encore membre — après quitter, household vaut null et seul le profil
  // est exporté). Disponible avant suppression et pendant la grâce 7j.
  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);
    setExportError('');
    setExportDone(false);
    try {
      const { data, error } = await buildAccountExport(supabase, user.id);
      if (error || !data) {
        setExportError(error ?? 'errors.account.export_failed');
        return;
      }
      downloadAccountExport(data);
      setExportDone(true);
    } finally {
      setExporting(false);
    }
  };

  // PRD §4.9 : suppression = quitter (l'autre membre garde l'inventaire,
  // 0 lecture après départ) + soft-delete profiles.deleted_at (rétention 7j
  // RGPD, annulation par reconnexion <7j via AuthContext, purge cron >7j).
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    setDeleteError('');
    // Best-effort : même si le départ échoue (ex. déjà sans foyer), le
    // soft-delete doit être posé pour garantir la sortie + la purge 7j.
    await leaveHousehold(supabase);
    const { error } = await requestAccountDeletion(supabase, user.id);
    if (error) {
      setDeleteError(error);
      setDeleting(false);
      return;
    }
    // Soft-delete recorded (7-day retention, permanent deletion by the
    // member-gdpr-sweep cron); AuthContext transitions the private route to /login.
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

      <main className="app-main" id="main">
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>{t('account.title')}</h1>

        {restoredAccount && (
          <p className="account-feedback-success" role="status">
            {t('account.restored')}
          </p>
        )}
        {profileError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1rem' }}>{translateMessage(language, profileError)}</div>
        )}

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.name_section')}</h2>
          <div className="form-group">
            <label htmlFor="account-first-name">{t('account.first_name_label')}</label>
            <input
              id="account-first-name"
              type="text"
              data-testid="account-first-name-input"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setFirstNameError('');
                setNameSaveError('');
                setNameSaved(false);
              }}
              maxLength={50}
              autoComplete="given-name"
                aria-invalid={!!firstNameError}
                aria-describedby={firstNameError ? 'account-first-name-error' : undefined}
            />
            {firstNameError && <p className="notification-error field-error" role="alert" id="account-first-name-error" data-testid={firstNameError === 'validation.first_name.too_long' ? 'error-first-name-too-long' : 'error-first-name-required-letter'}>{translateMessage(language, firstNameError)}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="account-last-name">{t('account.last_name_label')}</label>
            <input
              id="account-last-name"
              type="text"
              data-testid="account-last-name-input"
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                setLastNameError('');
                setNameSaveError('');
                setNameSaved(false);
              }}
              maxLength={50}
              autoComplete="family-name"
                aria-invalid={!!lastNameError}
                aria-describedby={lastNameError ? 'account-last-name-error' : undefined}
            />
            {lastNameError && <p className="notification-error field-error" role="alert" id="account-last-name-error" data-testid={lastNameError === 'validation.last_name.too_long' ? 'error-last-name-too-long' : 'error-last-name-required-letter'}>{translateMessage(language, lastNameError)}</p>}
          </div>
          {nameSaveError && <p className="notification-error field-error" role="alert">{translateMessage(language, nameSaveError)}</p>}
          {nameSaved && (
            <p className="account-feedback-success" role="status">{t('account.name_saved')}</p>
          )}
          <button
            type="button"
            data-testid="account-save-button"
            className="btn btn-primary account-section-action"
            onClick={() => void handleSaveName()}
            disabled={nameSaving}
          >
            {nameSaving ? t('account.saving') : t('account.save')}
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
                data-testid="account-current-password-input"
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
                data-testid="account-new-password-input"
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
                data-testid="account-confirm-password-input"
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

        <section className="card account-section">
          <h2 className="account-section-title">{t('account.data_section')}</h2>
          <p className="text-muted account-section-hint">
            {t('account.data_hint')}
          </p>
          {exportError && <p className="notification-error" role="alert">{translateMessage(language, exportError)}</p>}
          {exportDone && (
            <p className="account-feedback-success" role="status" data-testid="account-export-success">{t('account.export_done')}</p>
          )}
          <button
            type="button"
            data-testid="account-export-button"
            className="btn btn-secondary"
            onClick={() => void handleExportData()}
            disabled={exporting}
          >
            {exporting ? t('account.exporting') : t('account.export_data')}
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
        <ConfirmDialog
          title={t('account.delete_title')}
          message={t('account.delete_hint')}
          confirmLabel={t('account.delete')}
          cancelLabel={t('common.cancel')}
          confirmTestId="account-delete-confirm"
          cancelTestId="account-delete-cancel"
          pending={deleting}
          pendingLabel={t('account.deleting')}
          tone="danger"
          onConfirm={() => void handleDeleteAccount()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}