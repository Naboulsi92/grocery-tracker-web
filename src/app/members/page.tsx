'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useHousehold } from '@/hooks/useHousehold';
import ThemeToggle from '@/components/ThemeToggle';

export default function MembersPage() {
  const [copied, setCopied] = useState(false);
  const { user, householdId } = useAuth();
  const { household, members, loading, error, invitation, actions } = useHousehold(householdId ?? '');

  const currentMembership = members.find((member) => member.user_id === user?.id);
  const isOwner = currentMembership?.role === 'owner';

  const handleCopyInvitation = async () => {
    setCopied(false);
    await actions.copyInviteCode();
    setCopied(true);
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
            <Link href="/home" className="back-link" aria-label="Retour à l’accueil" data-testid="back-link">
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
            {!household && <button type="button" className="btn btn-secondary" onClick={() => actions.refresh()}>Réessayer</button>}
          </div>
        )}

        {household && isOwner && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Invitation</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Créez un code à usage unique, valable sept jours. Le code complet n’est affiché qu’ici.
            </p>
            {invitation.status === 'none' || invitation.status === 'creating' ? (
              <button type="button" onClick={() => actions.createInvitation()} disabled={invitation.status === 'creating'} className="btn btn-primary">
                {invitation.status === 'creating' ? 'Création...' : 'Créer une invitation'}
              </button>
            ) : (
              <div className="invite-code-display">
                <code className="invite-code-text" style={{ overflowWrap: 'anywhere' }}>{invitation.token}</code>
                <button type="button" onClick={handleCopyInvitation} disabled={invitation.status === 'revoking'} className="btn btn-secondary" aria-describedby="copy-status">
                  {copied ? 'Copié !' : 'Copier'}
                </button>
                <button type="button" onClick={() => actions.revokeInvitation(invitation.invitationId)} disabled={invitation.status === 'revoking'} className="btn btn-secondary">
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
