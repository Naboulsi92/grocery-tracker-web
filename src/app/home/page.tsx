'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useHousehold } from '@/hooks/useHousehold';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import ThemeToggle from '@/components/ThemeToggle';

export default function HomePage() {
  const { user, householdId, signOut } = useAuth();
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
    // AuthContext transitions the private route guard to /login.
  };

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container">
          <p role="alert">{error || 'Foyer introuvable.'}</p>
          <button type="button" className="btn btn-primary" onClick={() => refresh()}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <ThemeToggle />
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h1>{household.name}</h1>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="dashboard-grid">
          <Link href="/categories" className="dashboard-card animate-fade-in" style={{ animationDelay: '0ms' }} data-testid="dashboard-card-categories">
            <div className="card-icon" aria-hidden="true" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent-hover)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2>Catégories</h2>
            <p className="text-muted">Gérer les catégories</p>
          </Link>

          <Link href="/items" className="dashboard-card animate-fade-in" style={{ animationDelay: '50ms' }} data-testid="dashboard-card-items">
            <div className="card-icon card-icon-info" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <h2>Articles</h2>
            <p className="text-muted">Voir et modifier</p>
          </Link>

          <Link href="/to-buy" className="dashboard-card animate-fade-in" style={{ animationDelay: '100ms' }} data-testid="dashboard-card-to-buy">
            <div className="card-icon card-icon-warning" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2>À acheter</h2>
            <p className="text-muted">Articles en rupture</p>
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
            <h2>Membres</h2>
            <p className="text-muted">Voir les membres et gérer les invitations</p>
          </Link>

          {isSupported && (
            <section className="dashboard-card notification-card animate-fade-in" style={{ animationDelay: '200ms' }} aria-labelledby="notifications-title">
              <div className="card-icon card-icon-alert" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <h2 id="notifications-title">Notifications</h2>
              <p className="text-muted" aria-live="polite">
                {permission === 'granted' && localSubscription === 'subscribed'
                  ? serverSync === 'synced' ? 'Activées sur cet appareil' : 'Activées localement'
                  : permission === 'denied'
                    ? 'Bloquées'
                    : permission === 'granted'
                      ? 'Autorisées, mais non abonnées sur cet appareil'
                      : 'Désactivées'}
              </p>
              {pushError && <p className="notification-error" role="alert">{pushError}</p>}
              {permission === 'granted' && (localSubscription === 'subscribed' || pushEndpoint) ? (
                <button
                  onClick={() => void unsubscribe()}
                  className="btn btn-secondary"
                  disabled={pushLoading}
                >
                  {operation === 'disabling' ? 'Désactivation…' : 'Désactiver'}
                </button>
              ) : permission !== 'denied' && (
                <button
                  onClick={() => void requestPermission()}
                  className="btn btn-secondary"
                  disabled={pushLoading}
                >
                  {operation === 'enabling' ? 'Activation…' : 'Activer'}
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
