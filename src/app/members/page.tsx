'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { translateMessage } from '@/lib/i18n';

export default function MembersPage() {
  const [copied, setCopied] = useState(false);
  const { user, householdId } = useAuth();
  const { t, language } = useI18n();
  const { household, members, loading, error, invitation, actions } = useHousehold(householdId ?? '', { language });

  const isHouseholdFull = members.length >= 2;

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
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

return (
    <div className="page-container">
      <AuthenticatedHeader
        showBackLink
        household={household}
        loading={loading}
        error={error}
        trailingAction={
          <button onClick={() => actions.refresh()} className="btn btn-secondary">
            {t('common.retry')}
          </button>
        }
      />

      <main className="app-main">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1rem' }}>
            {translateMessage(language, error)}
            {!household && <button type="button" className="btn btn-secondary" onClick={() => actions.refresh()}>{t('common.retry')}</button>}
          </div>
        )}

        {household && isHouseholdFull && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.invitation')}</h2>
            <p data-testid="household-full-message">{t('members.full')}</p>
          </div>
        )}

        {household && !isHouseholdFull && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.invitation')}</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {t('members.invite_hint')}
            </p>
            {invitation.status === 'none' || invitation.status === 'creating' ? (
              <button type="button" onClick={() => actions.createInvitation()} disabled={invitation.status === 'creating'} className="btn btn-primary">
                {invitation.status === 'creating' ? t('members.creating') : t('members.create_invitation')}
              </button>
            ) : (
              <div className="invite-code-display">
                <code className="invite-code-text" style={{ overflowWrap: 'anywhere' }}>{invitation.token}</code>
                <button type="button" onClick={handleCopyInvitation} disabled={invitation.status === 'revoking'} className="btn btn-secondary" aria-describedby="copy-status">
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
                <button type="button" onClick={() => actions.revokeInvitation(invitation.invitationId)} disabled={invitation.status === 'revoking'} className="btn btn-secondary">
                  {invitation.status === 'revoking' ? t('members.revoking') : t('members.revoke')}
                </button>
                <span id="copy-status" className="sr-only" aria-live="polite">{copied ? t('members.copied_aria') : ''}</span>
                <p className="text-muted">{t('members.expires', { date: new Date(invitation.expiresAt).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') })}</p>
              </div>
            )}
          </div>
        )}

        {household && (
          <div className="card">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.counter', { count: members.length })}</h2>
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
                      {member.role === 'owner' ? t('members.role_owner') : t('members.role_member')}
                      {member.joined_at ? t('members.joined_since', { date: new Date(member.joined_at).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') }) : ''}
                    </span>
                  </div>
                  {member.user_id === user?.id && <span className="member-badge">{t('members.you')}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
