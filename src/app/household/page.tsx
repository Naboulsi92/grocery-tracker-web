'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { useHousehold } from '@/hooks/useHousehold';
import { AuthenticatedHeader } from '@/components/AuthenticatedHeader';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AccessibleDialog } from '@/components/AccessibleDialog';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient } from '@/utils/supabase/client';
import { translateMessage } from '@/lib/i18n';
import { buildInvitationLink } from '@/lib/household';
import { validateName } from '@/lib/validation';
import type { Database } from '@/types/database';

type HouseholdUpdate = Database['public']['Tables']['households']['Update'];

export default function HouseholdPage() {
  const { user, householdId } = useAuth();
  const { t, language } = useI18n();
  const { household, members, invitation, loading, error, actions } = useHousehold(householdId ?? '', { language });

  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leftHousehold, setLeftHousehold] = useState(false);

  const isFull = members.length >= 2;
  const [supabase] = useState(createClient);

  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const invitationToken =
    invitation.status === 'active' || invitation.status === 'revoking' ? invitation.token : null;

  useEffect(() => {
    if (!invitationToken) return;
    let cancelled = false;
    const joinUrl = buildInvitationLink(window.location.origin, invitationToken);
    void import('qrcode')
      .then((mod) => {
        const QR = (mod as unknown as { default?: typeof import('qrcode') }).default ?? mod;
        return QR.toDataURL(joinUrl, { errorCorrectionLevel: 'L', width: 160 });
      })
      .then((url) => { if (!cancelled) setQrCodeUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [invitationToken]);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameSaved(false);
    setNameError('');
  };

  const handleSaveName = async () => {
    const nameErr = validateName(name);
    if (nameErr) {
      setNameError(nameErr);
      return;
    }
    if (!householdId) return;

    setSavingName(true);
    setNameError('');
    const { error: updateError } = await supabase
      .from('households')
      .update({ name: name.trim() } satisfies HouseholdUpdate)
      .eq('id', householdId);
    setSavingName(false);

    if (updateError) {
      setNameError(t('household.save_failed'));
      return;
    }
    setNameSaved(true);
    actions.refresh();
  };

  const handleCopyInvitation = async () => {
    setCopied(false);
    await actions.copyInviteCode();
    setCopied(true);
  };

  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = async (link: string) => {
    setLinkCopied(false);
    const done = await actions.copyText(link);
    setLinkCopied(done);
  };

  const handleRegenerate = async () => {
    if (invitation.status !== 'active' && invitation.status !== 'revoking') return;
    if (!invitation.invitationId) return;
    await actions.revokeInvitation(invitation.invitationId);
    await actions.createInvitation();
    setShowRegenConfirm(false);
  };

  // PRD §4.8 : quitter via RPC leave_household (le delete direct est 42501 :
  // aucun grant DELETE client). On vide l'état local → 0 lecture inventaire,
  // RLS refusant ensuite toute lecture serveur. L'autre membre garde tout
  // intact sans limite de durée. Pas de signOut ici : PrivateRoute
  // redirigerait vers /login et masquerait l'écran post-leave
  // (« Vous avez quitté le foyer ») attendu par l'e2e ; l'utilisateur reste
  // authentifié sans foyer (prochaine navigation → /join-household).
  const handleLeaveHousehold = async () => {
    if (!user?.id || !householdId) return;
    setLeaving(true);
    const { error: leaveError } = await actions.leave(user.id);
    setLeaving(false);
    if (leaveError) {
      setShowLeaveConfirm(false);
      return;
    }
    setShowLeaveConfirm(false);
    setLeftHousehold(true);
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

  if (leftHousehold) {
    return (
      <div className="page-container">
        <ThemeToggle />
      <main className="app-main" id="main">
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <p>{t('household.left_title')}</p>
            <span>{t('household.left_sub')}</span>
          </div>
        </main>
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
      />

      <main className="app-main" id="main">
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.5rem' }}>
            {translateMessage(language, error)}
          </div>
        )}

        {household && (
          <>
            {/* Page title (h1): the household name; header brand is a <p>. */}
            <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{household.name}</h1>
            {/* Household Name */}
            <section className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>{t('household.name_section')}</h2>
              <div className="form-group">
                <label htmlFor="household-name" className="sr-only">{t('household.name_section')}</label>
                <input
                  id="household-name"
                  type="text"
                  maxLength={50}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={household.name}
                  data-testid="household-name-input"
                  aria-describedby={nameError ? 'name-error' : undefined}
                />
              </div>
              {nameError && (
                <p id="name-error" className="auth-error" role="alert" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  {translateMessage(language, nameError)}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSaveName()}
                  disabled={savingName || name.trim() === household.name}
                  data-testid="household-name-save-button"
                >
                  {savingName ? t('common.saving') : t('common.save')}
                </button>
                {nameSaved && (
                  <span className="badge badge-success animate-fade-in">{t('common.saved')}</span>
                )}
              </div>
            </section>

            {/* Members List */}
            <section className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>
                {t('household.members_title', { count: members.length })}
              </h2>
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
            </section>

            {/* Invite Code Section */}
            {isFull ? (
              <section className="card" style={{ marginBottom: '1.5rem' }} data-testid="household-full-message">
                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>{t('household.invitation')}</h2>
                <p className="text-muted">{t('household.full')}</p>
              </section>
            ) : (
              <section className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem' }}>{t('household.invitation')}</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {t('household.invite_hint')}
                </p>

                {invitation.status === 'none' || invitation.status === 'creating' ? (
                  <button
                    type="button"
                    onClick={() => void actions.createInvitation()}
                    disabled={invitation.status === 'creating'}
                    className="btn btn-primary"
                    data-testid="invite-code-create-button"
                  >
                    {invitation.status === 'creating' ? t('members.creating') : t('household.generate')}
                  </button>
                ) : invitation.status === 'pending' ? (
                  <div data-testid="invite-pending-display">
                    {invitation.consumed ? (
                      <p data-testid="invite-accepted-note">{t('members.invite_accepted')}</p>
                    ) : invitation.revoked ? (
                      <p data-testid="invite-revoked-note">{t('members.invite_revoked')}</p>
                    ) : (
                      <p data-testid="invite-pending-note">
                        {t('members.pending_created', { date: new Date(invitation.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') })}
                        {' '}
                        {t('members.expires', { date: new Date(invitation.expiresAt).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div data-testid="invite-code-display">
                    <p data-testid="invite-shown-once" className="text-muted text-sm">{t('members.shown_once')}</p>
                    <p className="text-sm" style={{ fontWeight: 600 }}>{t('members.invite_link_label')}</p>
                    <div className="invite-code-display">
                      <code className="invite-link-text" data-testid="invite-link">{buildInvitationLink(window.location.origin, invitation.token)}</code>
                      <button
                        type="button"
                        onClick={() => void handleCopyLink(buildInvitationLink(window.location.origin, invitation.token))}
                        disabled={invitation.status === 'revoking'}
                        className="btn btn-secondary"
                        data-testid="invite-code-copy-link-button"
                      >
                        {linkCopied ? t('common.copied') : t('members.copy_link')}
                      </button>
                    </div>
                    <div className="invite-code-display">
                      <code className="invite-code-text">{invitation.token}</code>
                      <button
                        type="button"
                        onClick={() => void handleCopyInvitation()}
                        disabled={invitation.status === 'revoking'}
                        className="btn btn-secondary"
                        aria-describedby="copy-status"
                        data-testid="invite-code-copy-button"
                      >
                        {copied ? t('common.copied') : t('common.copy')}
                      </button>
                      <span id="copy-status" className="sr-only" aria-live="polite">
                        {copied ? t('members.copied_aria') : ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowRegenConfirm(true)}
                        disabled={invitation.status === 'revoking'}
                        className="btn btn-secondary"
                        data-testid="invite-code-regenerate-button"
                      >
                        {invitation.status === 'revoking' ? t('members.revoking') : t('household.regenerate')}
                      </button>
                      {invitation.expiresAt && (
                        <p className="text-muted text-sm">
                          {t('members.expires', { date: new Date(invitation.expiresAt).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR') })}
                        </p>
                      )}
                    </div>

                    {/* QR invite (encodes the join deep-link with the token) */}
                    {qrCodeUrl && invitationToken && (
                      <div style={{ marginTop: '1rem' }}>
                        <img
                          src={qrCodeUrl}
                          alt={t('household.qr_alt')}
                          width={160}
                          height={160}
                          data-testid="invite-qr-code"
                        />
                        <p className="text-muted text-sm">
                          {t('household.qr_caption')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Leave Household */}
            <section className="card" style={{ borderColor: 'var(--color-danger)' }}>
              <h2 style={{ marginBottom: '0.5rem', fontSize: '1.125rem', color: 'var(--color-danger)' }}>
                {t('household.leave_section')}
              </h2>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>
                {t('household.leave_hint')}
              </p>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowLeaveConfirm(true)}
                data-testid="leave-household-button"
              >
                {t('household.leave_button')}
              </button>
            </section>
          </>
        )}
      </main>

      {/* Regenerate Confirmation Modal */}
      {showRegenConfirm && (
        <AccessibleDialog
          title={t('household.regen_title')}
          message={t('household.regen_hint')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          confirmTestId="invite-code-regenerate-confirm"
          cancelTestId="invite-regenerate-cancel-button"
          dialogTestId="invite-regenerate-dialog"
          tone="primary"
          onConfirm={() => void handleRegenerate()}
          onCancel={() => setShowRegenConfirm(false)}
        />
      )}

      {/* Leave Household Confirmation Modal — PRD §4.8 texte exact + Confirmer/Annuler */}
      {showLeaveConfirm && (
        <ConfirmDialog
          title={t('household.leave_confirm_title')}
          message={t('household.leave_hint')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          confirmTestId="leave-household-confirm"
          cancelTestId="leave-household-cancel"
          pending={leaving}
          pendingLabel={t('household.leaving')}
          tone="danger"
          onConfirm={() => void handleLeaveHousehold()}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1rem;
        }
        .modal-content {
          background: var(--color-surface);
          border: 1px solid var(--color-border-subtle);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-lg);
        }
        .modal-content h3 {
          font-size: 1.125rem;
        }
        .btn-danger {
          background: var(--color-danger);
          color: #fff;
        }
        .btn-danger:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
