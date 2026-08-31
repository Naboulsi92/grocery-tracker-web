'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import ThemeToggle from '@/components/ThemeToggle';

interface Household {
  id: string;
  name: string;
}

export default function HomePage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const { permission, requestPermission, isSupported } = usePushNotifications(user?.id || null);

  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    async function fetchHousehold() {
      if (!user || !supabase) {
        router.push('/login');
        return;
      }
      
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .single();

        if (memberError) {
          console.error('Failed to fetch household membership:', memberError);
          setLoading(false);
          return;
        }

        if (!memberData?.household_id) {
          setLoading(false);
          return;
        }

        const { data: householdData, error: householdError } = await supabase
          .from('households')
          .select('id, name')
          .eq('id', memberData.household_id)
          .single();

        if (householdError) {
          console.error('Failed to fetch household:', householdError);
        } else if (householdData) {
          setHousehold(householdData as Household);
        }
      } catch (err) {
        console.error('Error in fetchHousehold:', err);
      }
      setLoading(false);
    }

    fetchHousehold();
  }, [user, router, supabase]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!household) {
    router.push('/join-household');
    return null;
  }

  return (
    <div className="page-container">
      <ThemeToggle />
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h1>{household.name}</h1>
          </div>
          <button onClick={handleSignOut} className="btn btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <Link href="/categories" className="dashboard-card animate-fade-in" style={{ animationDelay: '0ms' }}>
            <div className="card-icon" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2>Catégories</h2>
            <p className="text-muted">Gérer les catégories</p>
          </Link>

          <Link href="/items" className="dashboard-card animate-fade-in" style={{ animationDelay: '50ms' }}>
            <div className="card-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <h2>Articles</h2>
            <p className="text-muted">Voir et modifier</p>
          </Link>

          <Link href="/to-buy" className="dashboard-card animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="card-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2>À acheter</h2>
            <p className="text-muted">Articles en rupture</p>
          </Link>

          <div className="dashboard-card animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="card-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2>Membres</h2>
            <p className="text-muted">Inviter des membres</p>
            <div className="invite-code">
              <span className="code-label">Code:</span>
              <code>{household.id.slice(0, 8)}</code>
            </div>
          </div>

          {isSupported && (
            <div className="dashboard-card animate-fade-in" style={{ animationDelay: '200ms' }}>
              <div className="card-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <h2>Notifications</h2>
              <p className="text-muted">
                {permission === 'granted' 
                  ? 'Activées' 
                  : permission === 'denied'
                    ? 'Bloquées'
                    : 'Désactivées'}
              </p>
              {permission !== 'granted' && permission !== 'denied' && (
                <button
                  onClick={requestPermission}
                  className="btn btn-secondary"
                  style={{ marginTop: '0.75rem' }}
                >
                  Activer
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}