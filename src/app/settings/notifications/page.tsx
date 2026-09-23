'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { createClient } from '@/utils/supabase/client';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  type NotificationType,
} from '@/lib/notificationSettings';
import ThemeToggle from '@/components/ThemeToggle';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { translateMessage } from '@/lib/i18n';

interface NotificationDraft {
  notificationType: NotificationType;
  reminderEnabled: boolean;
  reminderTime: string;
}

const DEFAULT_DRAFT: NotificationDraft = {
  notificationType: 'none',
  reminderEnabled: false,
  reminderTime: '08:00',
};

function buildTypeOptions(t: (key: string) => string): { value: NotificationType; label: string; description: string; testId?: string }[] {
  return [
    { value: 'none', label: t('notif.off'), description: t('notif.off_desc') },
    { value: 'push', label: t('notif.push'), description: t('notif.push_desc'), testId: 'notification-push-toggle' },
    { value: 'badge', label: t('notif.badge'), description: t('notif.badge_desc'), testId: 'notification-badge-toggle' },
    { value: 'both', label: t('notif.both'), description: t('notif.both_desc') },
  ];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function NotificationSettingsPage() {
  const { user, householdId } = useAuth();
  const { t, language } = useI18n();
  const { household, loading: householdLoading, error: householdError } = useHousehold(householdId ?? '');
  const typeOptions = buildTypeOptions(t);
  const {
    permission,
    localSubscription,
    serverSync,
    operation,
    endpoint: pushEndpoint,
    error: pushError,
    requestPermission,
    subscribe,
    unsubscribe,
    isSupported,
    isLoading: pushLoading,
  } = usePushNotifications(user?.id ?? null);

  const [supabase] = useState(createClient);
  const [draft, setDraft] = useState<NotificationDraft>(DEFAULT_DRAFT);
  const [savedDraft, setSavedDraft] = useState<NotificationDraft>(DEFAULT_DRAFT);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadRequest, setLoadRequest] = useState(0);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [saveFieldError, setSaveFieldError] = useState('');
  const [pushActionError, setPushActionError] = useState('');

  const dirty =
    draft.notificationType !== savedDraft.notificationType ||
    draft.reminderEnabled !== savedDraft.reminderEnabled ||
    draft.reminderTime !== savedDraft.reminderTime;

  const wantsPush = draft.notificationType === 'push' || draft.notificationType === 'both';
  const pushActiveOnDevice =
    wantsPush &&
    permission === 'granted' &&
    (localSubscription === 'subscribed' || Boolean(pushEndpoint));

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user?.id) return;
      setSettingsLoading(true);
      setLoadError('');
      setSaveError('');
      setSaveFieldError('');

      const result = await loadNotificationSettings(supabase, user.id);
      if (!active) return;

      if (result.error || !result.settings) {
        setLoadError(result.error ?? 'errors.notifications.load_failed');
        setDraft(DEFAULT_DRAFT);
        setSavedDraft(DEFAULT_DRAFT);
        setSettingsLoading(false);
        return;
      }

      const next: NotificationDraft = {
        notificationType: result.settings.notificationType,
        reminderEnabled: result.settings.reminderTime !== null,
        reminderTime: result.settings.reminderTime ?? '08:00',
      };
      setDraft(next);
      setSavedDraft(next);
      setSettingsLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase, user?.id, loadRequest]);

  const handleTypeSelect = (value: NotificationType) => {
    setDraft((current) => ({ ...current, notificationType: value }));
    setStatus('idle');
    setSaveError('');
    setSaveFieldError('');
    setPushActionError('');

    const nextWantsPush = value === 'push' || value === 'both';
    if (nextWantsPush && isSupported && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      void requestPermission().then(({ error }) => {
        if (error) setPushActionError(error.message);
      });
    }
  };

  const handleReminderToggle = (enabled: boolean) => {
    setDraft((current) => ({ ...current, reminderEnabled: enabled }));
    setStatus('idle');
    setSaveError('');
    setSaveFieldError('');
  };

  const handleReminderTime = (value: string) => {
    setDraft((current) => ({ ...current, reminderTime: value }));
    setStatus('idle');
    setSaveError('');
    setSaveFieldError('');
  };

  const handleEnablePush = async () => {
    setPushActionError('');
    const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    const { error } = granted ? await subscribe() : await requestPermission();
    if (error) setPushActionError(error.message);
  };

  const handleDisablePush = async () => {
    setPushActionError('');
    const { error } = await unsubscribe();
    if (error) setPushActionError(error.message);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (draft.reminderEnabled && !draft.reminderTime) {
      setSaveFieldError(t('notif.reminder_required'));
      return;
    }

    setStatus('saving');
    setSaveError('');
    setSaveFieldError('');

    const { error } = await saveNotificationSettings(supabase, user.id, {
      notificationType: draft.notificationType,
      reminderTime: draft.reminderEnabled ? draft.reminderTime : null,
    });

    if (error) {
      setStatus('error');
      setSaveError(error);
      return;
    }

    setSavedDraft(draft);
    setStatus('saved');
  };

  if (settingsLoading) {
    return (
      <div className="page-container">
        <OfflineBanner />
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <OfflineBanner />
      <AuthenticatedHeader
        showBackLink
        household={household}
        loading={householdLoading}
        error={householdError}
      />

      <main className="app-main">
        <h2>{t('notif.title')}</h2>

        {loadError && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            <span>{translateMessage(language, loadError)}</span>
            <button type="button" className="btn btn-secondary" onClick={() => setLoadRequest((request) => request + 1)} data-testid="notifications-retry-button">
              {t('common.retry')}
            </button>
          </div>
        )}

        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>{t('notif.type_section')}</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            {t('notif.type_hint')}
          </p>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="sr-only">{t('notif.type_legend')}</legend>
            <div className="notif-type-options">
              {typeOptions.map((option) => {
                const checked = draft.notificationType === option.value;
                return (
                  <label key={option.value} className={`notif-option${checked ? ' checked' : ''}`}>
                    <input
                      type="radio"
                      name="notification-type"
                      value={option.value}
                      checked={checked}
                      onChange={() => handleTypeSelect(option.value)}
                      data-testid={option.testId}
                    />
                    <span>
                      <span className="notif-option-title">{option.label}</span>
                      <span className="notif-option-desc">{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {wantsPush && (
            <div className="notif-push-status" aria-live="polite">
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                {!isSupported
                  ? t('notif.unsupported')
                  : permission === 'denied'
                    ? t('notif.blocked_browser')
                    : pushActiveOnDevice
                      ? serverSync === 'synced'
                        ? t('notif.enabled_device')
                        : t('notif.enabled_local')
                      : permission === 'granted'
                        ? t('notif.granted_no_sub')
                        : operation === 'enabling'
                          ? t('notif.enabling_device')
                          : t('notif.allow_device')}
              </p>

              {isSupported && permission !== 'denied' && !pushActiveOnDevice && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleEnablePush()}
                  data-testid="notifications-enable-push-button"
                  disabled={pushLoading || operation !== 'idle'}
                  style={{ marginTop: '0.75rem' }}
                >
                  {operation === 'enabling' ? t('notif.enabling') : t('notif.enable_device')}
                </button>
              )}
              {pushActiveOnDevice && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void handleDisablePush()}
                  data-testid="notifications-disable-push-button"
                  disabled={pushLoading || operation !== 'idle'}
                  style={{ marginTop: '0.75rem' }}
                >
                  {operation === 'disabling' ? t('notif.disabling') : t('notif.disable')}
                </button>
              )}

              {pushActionError && <p className="notification-error" role="alert">{pushActionError}</p>}
              {pushError && <p className="notification-error" role="alert">{pushError}</p>}
            </div>
          )}
        </section>

        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('notif.reminder_section')}</h2>

          <label className="notif-toggle-row">
            <input
              type="checkbox"
              data-testid="notification-reminder-toggle"
              checked={draft.reminderEnabled}
              onChange={(event) => handleReminderToggle(event.target.checked)}
            />
            <span>{t('notif.reminder_toggle')}</span>
          </label>

          <div className="form-group" style={{ maxWidth: '16rem', marginTop: '1rem' }}>
            <label htmlFor="notification-reminder-time">{t('notif.reminder_time')}</label>
            <input
              id="notification-reminder-time"
              type="time"
              data-testid="notification-reminder-time"
              value={draft.reminderTime}
              onChange={(event) => handleReminderTime(event.target.value)}
              disabled={!draft.reminderEnabled}
            />
          </div>

          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
            {t('notif.reminder_hint')}
          </p>
        </section>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="notification-save-button"
            onClick={() => void handleSave()}
            disabled={!dirty || status === 'saving' || settingsLoading}
          >
            {status === 'saving' ? t('notif.saving') : t('notif.save')}
          </button>
          {status === 'saved' && !dirty && (
            <span className="badge badge-success animate-fade-in">{t('notif.saved')}</span>
          )}
          {saveFieldError && (
            <span style={{ color: 'var(--color-danger)' }} role="alert">{saveFieldError}</span>
          )}
        </div>
        {saveError && (
          <p className="auth-error" role="alert" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {translateMessage(language, saveError)}
          </p>
        )}
      </main>
    </div>
  );
}