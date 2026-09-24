'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import ThemeToggle from '@/components/ThemeToggle';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { buildInvitationLink } from '@/lib/household';
import { translateMessage } from '@/lib/i18n';

export default function MembersPage() {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { user, householdId } = useAuth();
  const { t, language } = useI18n();
  const { household, members, loading, error, invitation, actions } = useHousehold(householdId ?? '', { language });

  const isHouseholdFull = members.length >= 2;
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  const handleCopyInvitation = async () => {
    setCopied(false);
    const copied = await actions.copyInviteCode();
    setCopied(copied);
  };

  const handleCopyLink = async (link: string) => {
    setLinkCopied(false);
    const done = await actions.copyText(link);
    setLinkCopied(done);
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
          <button onClick={() => actions.refresh()} className="btn btn-secondary" data-testid="members-refresh-button">
            {t('common.retry')}
          </button>
        }
      />

      <main className="app-main" id="main">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1rem' }}>
            {translateMessage(language, error)}
            {!household && <button type="button" className="btn btn-secondary" onClick={() => actions.refresh()} data-testid="members-error-retry-button">{t('common.retry')}</button>}
          </div>
        )}

        {household && isHouseholdFull && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.invitation')}</h2>
            <p data-testid="household-full-message">{t('members.full')}</p>
            {invitation.status === 'pending' && invitation.consumed && (
              <p data-testid="invite-accepted-note">{t('members.invite_accepted')}</p>
            )}
          </div>
        )}

        {household && !isHouseholdFull && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.invitation')}</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {t('members.invite_hint')}
            </p>
            {invitation.status === 'none' || invitation.status === 'creating' ? (
              <>
                <button type="button" onClick={() => actions.createInvitation()} disabled={invitation.status === 'creating'} className="btn btn-primary" data-testid="members-create-invitation-button">
                  {invitation.status === 'creating' ? t('members.creating') : t('members.create_invitation')}
                </button>
                <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>{t('members.retires_previous')}</p>
              </>
            ) : invitation.status === 'pending' ? (
              <div className="invite-code-display" data-testid="invite-pending-display">
                {invitation.consumed ? (
                  <p data-testid="invite-accepted-note">{t('members.invite_accepted')}</p>
                ) : invitation.revoked ? (
                  <p data-testid="invite-revoked-note">{t('members.invite_revoked')}</p>
                ) : new Date(invitation.expiresAt) <= new Date() ? (
                  <p data-testid="invite-expired-note">{t('members.invite_expired')}</p>
                ) : (
                  <p data-testid="invite-pending-note">
                    {t('members.pending_created', { date: new Date(invitation.createdAt).toLocaleDateString(locale) })}
                    {' '}
                    {t('members.expires', { date: new Date(invitation.expiresAt).toLocaleDateString(locale) })}
                  </p>
                )}
                {invitation.consumed || invitation.revoked || new Date(invitation.expiresAt) <= new Date() ? (
                  <button type="button" onClick={() => actions.createInvitation()} className="btn btn-primary" data-testid="members-create-invitation-button">
                    {t('members.create_new')}
                  </button>
                ) : (
                  <button type="button" onClick={() => actions.revokeInvitation(invitation.invitationId)} className="btn btn-secondary" data-testid="members-revoke-invitation-button">
                    {t('members.revoke')}
                  </button>
                )}
              </div>
            ) : (
              <div className="invite-code-display">
                <p data-testid="invite-shown-once" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('members.shown_once')}</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t('members.invite_link_label')}</p>
                <code className="invite-link-text" style={{ overflowWrap: 'anywhere' }} data-testid="invite-link">{buildInvitationLink(window.location.origin, invitation.token)}</code>
                <button type="button" onClick={() => void handleCopyLink(buildInvitationLink(window.location.origin, invitation.token))} disabled={invitation.status === 'revoking'} className="btn btn-secondary" data-testid="members-copy-link-button">
                  {linkCopied ? t('common.copied') : t('members.copy_link')}
                </button>
                <code className="invite-code-text" style={{ overflowWrap: 'anywhere' }}>{invitation.token}</code>
                <input
                  type="text"
                  readOnly
                  value={invitation.token}
                  data-testid="invite-code-token"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button type="button" onClick={handleCopyInvitation} disabled={invitation.status === 'revoking'} className="btn btn-secondary" aria-describedby="copy-status" data-testid="members-copy-invitation-button">
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
                <button type="button" onClick={() => actions.revokeInvitation(invitation.invitationId)} disabled={invitation.status === 'revoking'} className="btn btn-secondary" data-testid="members-revoke-invitation-button">
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
            <h1 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('members.counter', { count: members.length })}</h1>
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
                    <span className="member-email">{member.fullName}</span>
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
