'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { householdActionError, normalizeInvitationToken } from '@/lib/household';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthHeader } from '@/components/AuthHeader';

type PendingAction = 'create' | 'join' | null;

export default function JoinHouseholdPage() {
  const [invitationToken, setInvitationToken] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const { access, retryHousehold } = useAuth();
  const router = useRouter();
  const [supabase] = useState(createClient);

  useEffect(() => {
    if (access.status === 'anonymous') router.replace('/login');
    if (access.status === 'member') router.replace('/home');
  }, [access.status, router]);

  const finishOnboarding = () => {
    retryHousehold();
    router.replace('/home');
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setPendingAction('create');

    const { error: createError } = await supabase.rpc('create_household', {
      p_name: householdName.trim() || 'Mon Foyer',
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

    const token = normalizeInvitationToken(invitationToken);
    const { error: joinError } = await supabase.rpc('consume_household_invitation', { p_token: token });

    if (joinError) {
      setError(householdActionError('join', joinError));
      setPendingAction(null);
      return;
    }

    finishOnboarding();
  };

  if (access.status === 'loading' || access.status === 'member' || access.status === 'anonymous') {
    return (
      <div className="auth-container">
        <ThemeToggle />
        <div className="auth-card">
          <div className="loading-container" role="status">
            <div className="loading-spinner" aria-hidden="true" />
            <p>Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <ThemeToggle />
      <div className="auth-card animate-fade-in">
        <AuthHeader
          showBackHome
          showSignOut
          title="Votre foyer"
          subtitle="Choisissez de créer un foyer ou d'en rejoindre un avec une invitation."
        />

        {access.status === 'error' && (
          <div className="auth-error" role="alert">
            Impossible de vérifier votre foyer. Vous pouvez réessayer.
            <button type="button" className="btn btn-secondary" onClick={retryHousehold}>Réessayer</button>
          </div>
        )}

        {error && <div className="auth-error" role="alert">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section aria-labelledby="create-household-title">
            <h2 id="create-household-title" style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>Créer un nouveau foyer</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="sr-only" htmlFor="household-name">Nom du foyer</label>
              <input
                id="household-name"
                type="text"
                placeholder="Nom du foyer (optionnel)"
                value={householdName}
                onChange={(event) => setHouseholdName(event.target.value)}
                disabled={pendingAction !== null}
              />
              <button type="submit" disabled={pendingAction !== null} className="btn btn-primary" style={{ background: 'var(--color-accent)' }}>
                {pendingAction === 'create' ? 'Création...' : 'Créer mon foyer'}
              </button>
            </form>
          </section>

          <div className="divider"><span>ou</span></div>

          <section aria-labelledby="join-household-title">
            <h2 id="join-household-title" style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 500 }}>Rejoindre un foyer existant</h2>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="sr-only" htmlFor="invitation-token">Code d&apos;invitation complet</label>
              <input
                id="invitation-token"
                type="text"
                placeholder="Code d’invitation complet"
                value={invitationToken}
                onChange={(event) => setInvitationToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={pendingAction !== null}
                required
              />
              <button type="submit" disabled={pendingAction !== null} className="btn btn-primary">
                {pendingAction === 'join' ? 'Connexion...' : 'Rejoindre le foyer'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
