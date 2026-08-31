'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  householdActionError,
  mergeHouseholdMembers,
  type HouseholdMember,
  type InvitationState,
} from '@/lib/household';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

interface Household {
  id: string;
  name: string;
}

export default function MembersPage() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadRequest, setLoadRequest] = useState(0);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<InvitationState>({ status: 'none' });
  const [copied, setCopied] = useState(false);
  const { user, householdId } = useAuth();
  const [supabase] = useState(createClient);

  const currentMembership = members.find((member) => member.user_id === user?.id);
  const isOwner = currentMembership?.role === 'owner';

  useEffect(() => {
    let active = true;

    async function fetchData() {
      if (!householdId) return;
      setLoading(true);
      setError('');

      const [householdResult, membersResult] = await Promise.all([
        supabase.from('households').select('id, name').eq('id', householdId).maybeSingle(),
        supabase
          .from('household_members')
          .select('user_id, role, joined_at')
          .eq('household_id', householdId)
          .order('joined_at', { ascending: true }),
      ]);

      if (!active) return;
      if (householdResult.error || membersResult.error || !householdResult.data) {
        setError(householdActionError('load', householdResult.error || membersResult.error));
        setLoading(false);
        return;
      }

      const memberships = membersResult.data ?? [];
      const userIds = memberships.map((membership) => membership.user_id);
      const profilesResult = userIds.length
        ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
        : { data: [], error: null };

      if (!active) return;
      if (profilesResult.error) {
        setError(householdActionError('load', profilesResult.error));
        setLoading(false);
        return;
      }

      setHousehold(householdResult.data);
      setMembers(mergeHouseholdMembers(memberships, profilesResult.data ?? []));
      setLoading(false);
    }

    void fetchData();
    return () => { active = false; };
  }, [householdId, loadRequest, supabase]);

  const createInvitation = async () => {
    if (!householdId) return;
    setError('');
    setCopied(false);
    setInvitation({ status: 'creating' });

    const { data, error: invitationError } = await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
    });
    const created = data?.[0];

    if (invitationError || !created) {
      setError(householdActionError('invite', invitationError));
      setInvitation({ status: 'none' });
      return;
    }

    setInvitation({
      status: 'active',
      invitationId: created.invitation_id,
      token: created.token,
      expiresAt: created.expires_at,
    });
  };

  const copyInvitation = async () => {
    if (invitation.status !== 'active') return;
    setError('');
    try {
      await navigator.clipboard.writeText(invitation.token);
      setCopied(true);
    } catch (copyError) {
      setError(householdActionError('copy', copyError instanceof Error ? copyError : null));
    }
  };

  const revokeInvitation = async () => {
    if (invitation.status !== 'active') return;
    const activeInvitation = invitation;
    setError('');
    setInvitation({ ...activeInvitation, status: 'revoking' });

    const { data: revoked, error: revokeError } = await supabase.rpc('revoke_household_invitation', {
      p_invitation_id: activeInvitation.invitationId,
    });

    if (revokeError || !revoked) {
      setError(householdActionError('revoke', revokeError));
      setInvitation(activeInvitation);
      return;
    }

    setInvitation({ status: 'none' });
    setCopied(false);
  };

  if (loading) {
    return (
      <div className="page-container">
        <ThemeToggle />
        <div className="loading-container" role="status">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Chargement...</p>
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
            <Link href="/home" className="back-link" aria-label="Retour à l’accueil">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <h1>Membres{household ? ` de ${household.name}` : ''}</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
            {!household && <button type="button" className="btn btn-secondary" onClick={() => setLoadRequest((request) => request + 1)}>Réessayer</button>}
          </div>
        )}

        {household && isOwner && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Invitation</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Créez un code à usage unique, valable sept jours. Le code complet n’est affiché qu’ici.
            </p>
            {invitation.status === 'none' || invitation.status === 'creating' ? (
              <button type="button" onClick={createInvitation} disabled={invitation.status === 'creating'} className="btn btn-primary">
                {invitation.status === 'creating' ? 'Création...' : 'Créer une invitation'}
              </button>
            ) : (
              <div className="invite-code-display">
                <code className="invite-code-text" style={{ overflowWrap: 'anywhere' }}>{invitation.token}</code>
                <button type="button" onClick={copyInvitation} disabled={invitation.status === 'revoking'} className="btn btn-secondary" aria-describedby="copy-status">
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button type="button" onClick={revokeInvitation} disabled={invitation.status === 'revoking'} className="btn btn-secondary">
                  {invitation.status === 'revoking' ? 'Révocation...' : 'Révoquer'}
                </button>
                <span id="copy-status" className="sr-only" aria-live="polite">{copied ? 'Code d’invitation complet copié dans le presse-papiers' : ''}</span>
                <p className="text-muted">Expire le {new Date(invitation.expiresAt).toLocaleString('fr-FR')}</p>
              </div>
            )}
          </div>
        )}

        {household && !isOwner && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>Invitations</h2>
            <p className="text-muted">Seul le propriétaire du foyer peut inviter de nouveaux membres.</p>
          </div>
        )}

        {household && (
          <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Membres du foyer ({members.length})</h2>
            <div className="members-list">
              {members.map((member, index) => (
                <div key={member.user_id} className="member-item animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="member-avatar" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="member-info">
                    <span className="member-email">{member.displayName}</span>
                    <span className="member-joined">
                      {member.role === 'owner' ? 'Propriétaire' : 'Membre'}
                      {member.joined_at ? ` depuis le ${new Date(member.joined_at).toLocaleDateString('fr-FR')}` : ''}
                    </span>
                  </div>
                  {member.user_id === user?.id && <span className="member-badge">Vous</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
