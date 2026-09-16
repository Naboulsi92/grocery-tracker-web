'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { translateMessage } from '@/lib/i18n';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function HomePage() {
  const { user, householdId, signOut } = useAuth();
  const { t, language } = useI18n();
  const { household, loading, error, actions: { refresh } } = useHousehold(householdId || '');
  const {
    permission,
    localSubscription,
    serverSync,
    operation,
    endpoint: pushEndpoint,
    error: pushError,
    requestPermission,
    unsubscribe,
    isSupported,
    isLoading: pushLoading,
  } = usePushNotifications(user?.id || null);

  const handleSignOut = async () => {
    await signOut();
    // AuthContext transitions the private route guard to /login
  };

  if (loading) {
    return (
      <div className="page-container">
        <OfflineBanner />
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="page-container">
        <OfflineBanner />
        <ThemeToggle />
        <div className="loading-container">
          <p role="alert">{error ? translateMessage(language, error) : t('home.household_not_found')}</p>
          <button type="button" className="btn btn-primary" onClick={() => refresh()}>{t('common.retry')}</button>
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
        loading={loading}
        error={error}
        trailingAction={
          <button onClick={handleSignOut} className="btn btn-ghost">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {t('auth.sign_out')}
          </button>
        }
      />

      <main className="app-main">
        <h2>{t('home.title')}</h2>
        <div className="dashboard-grid">
          <Link href="/categories" className="dashboard-card animate-fade-in" style={{ animationDelay: '0ms' }} data-testid="dashboard-card-categories">
            <div className="card-icon" aria-hidden="true" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2>{t('home.categories')}</h2>
            <p className="text-muted">{t('home.categories_sub')}</p>
          </Link>

          <Link href="/items" className="dashboard-card animate-fade-in" style={{ animationDelay: '50ms' }} data-testid="dashboard-card-items">
            <div className="card-icon card-icon-info" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <h2>{t('home.items')}</h2>
            <p className="text-muted">{t('home.items_sub')}</p>
          </Link>

          <Link href="/to-buy" className="dashboard-card animate-fade-in" style={{ animationDelay: '100ms' }} data-testid="dashboard-card-to-buy">
            <div className="card-icon card-icon-warning" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2>{t('home.to_buy')}</h2>
            <p className="text-muted">{t('home.to_buy_sub')}</p>
          </Link>

          <Link href="/members" className="dashboard-card animate-fade-in" style={{ animationDelay: '150ms' }} data-testid="dashboard-card-members">
            <div className="card-icon card-icon-purple" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2>{t('home.members')}</h2>
            <p className="text-muted">{t('home.members_sub')}</p>
          </Link>

          <Link href="/household" className="dashboard-card animate-fade-in" style={{ animationDelay: '200ms' }} data-testid="dashboard-card-household">
            <div className="card-icon" aria-hidden="true" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <h2>{t('home.household')}</h2>
            <p className="text-muted">{t('home.household_sub')}</p>
          </Link>

          <Link href="/history" className="dashboard-card animate-fade-in" style={{ animationDelay: '250ms' }} data-testid="dashboard-card-history">
            <div className="card-icon card-icon-info" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5"/>
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                <path d="M12 7v5l4 2"/>
              </svg>
            </div>
            <h2>{t('dashboard.history')}</h2>
            <p className="text-muted">{t('dashboard.history_sub')}</p>
          </Link>

          <Link href="/account" className="dashboard-card animate-fade-in" style={{ animationDelay: '300ms' }} data-testid="dashboard-card-account">
            <div className="card-icon card-icon-purple" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h2>{t('dashboard.account')}</h2>
            <p className="text-muted">{t('dashboard.account_sub')}</p>
          </Link>

          <Link href="/settings/notifications" className="dashboard-card animate-fade-in" style={{ animationDelay: '350ms' }} data-testid="dashboard-card-notifications">
            <div className="card-icon card-icon-alert" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <h2>{t('dashboard.notifications')}</h2>
            <p className="text-muted">{t('dashboard.notifications_sub')}</p>
          </Link>

          {isSupported && (
            <section className="dashboard-card notification-card animate-fade-in" style={{ animationDelay: '400ms' }} aria-labelledby="notifications-title">
              <div className="card-icon card-icon-alert" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <h2 id="notifications-title">{t('home.notifications')}</h2>
              <p className="text-muted" aria-live="polite">
                {permission === 'granted' && localSubscription === 'subscribed'
                  ? serverSync === 'synced' ? t('home.notif_enabled') : t('home.notif_local')
                  : permission === 'denied'
                    ? t('home.notif_blocked')
                    : permission === 'granted'
                      ? t('home.notif_granted_no_sub')
                      : t('home.notif_off')}
              </p>
              {pushError && <p className="notification-error" role="alert">{pushError}</p>}
              {permission === 'granted' && (localSubscription === 'subscribed' || pushEndpoint) ? (
                <button
                  onClick={() => void unsubscribe()}
                  className="btn btn-secondary"
                  disabled={pushLoading}
                >
                  {operation === 'disabling' ? t('home.notif_disabling') : t('home.notif_disable')}
                </button>
              ) : permission !== 'denied' && (
                <button
                  onClick={() => void requestPermission()}
                  className="btn btn-secondary"
                  disabled={pushLoading}
                >
                  {operation === 'enabling' ? t('home.notif_enabling') : t('home.notif_enable')}
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
