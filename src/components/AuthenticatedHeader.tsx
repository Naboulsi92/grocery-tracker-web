'use client';

import { BrandIcon } from '@/components/BrandIcon';
import LanguageToggle from '@/components/LanguageToggle';
import { useI18n } from '@/contexts/LanguageContext';
import type { Household } from '@/hooks/useHousehold';

interface AuthenticatedHeaderProps {
  showBackLink?: boolean;
  onBackLinkClick?: () => void;
  trailingAction?: React.ReactNode;
  household?: Household | null;
  loading?: boolean;
  error?: string;
}

/** Ticket #71 : back-link isolé — même markup, mêmes testids. */
function HeaderBackLink({ onClick }: { onClick?: () => void }) {
  const { t } = useI18n();
  return (
    <button
      className="back-link"
      aria-label={t('auth.back_home')}
      onClick={onClick ?? (() => window.history.back())}
      data-testid="back-link"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </button>
  );
}

interface HeaderBrandProps {
  name: React.ReactNode;
  showBackLink?: boolean;
  onBackLinkClick?: () => void;
}

/** Ticket #71 : bloc marque (icône + retour + nom) partagé par les 3 états. */
function HeaderBrand({ name, showBackLink = false, onBackLinkClick }: HeaderBrandProps) {
  return (
    <div className="header-brand">
      <div className="brand-icon" aria-hidden="true">
        <BrandIcon />
      </div>
      {showBackLink ? <HeaderBackLink onClick={onBackLinkClick} /> : null}
      {name}
    </div>
  );
}

/** Ticket #71 : coquille header > header-content commune aux 3 états. */
function HeaderShell({ children }: { children: React.ReactNode }) {
  return (
    <header className="app-header">
      <div className="header-content">{children}</div>
    </header>
  );
}

export function AuthenticatedHeader({ showBackLink = false, onBackLinkClick, trailingAction, household, loading = false, error }: AuthenticatedHeaderProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <HeaderShell>
        <HeaderBrand
          name={<p className="header-brand-name">{t('header.loading')}</p>}
          showBackLink={showBackLink}
          onBackLinkClick={onBackLinkClick}
        />
      </HeaderShell>
    );
  }

  if (error) {
    return (
      <HeaderShell>
        <HeaderBrand
          name={<p className="header-brand-name">{t('header.error')}</p>}
          showBackLink={showBackLink}
          onBackLinkClick={onBackLinkClick}
        />
      </HeaderShell>
    );
  }

  return (
    <HeaderShell>
      <HeaderBrand
        name={<p className="header-brand-name" data-testid="header-household-name">{household?.name || t('header.default_name')}</p>}
        showBackLink={showBackLink}
        onBackLinkClick={onBackLinkClick}
      />
      <div className="header-actions">
        {trailingAction}
        <LanguageToggle />
      </div>
    </HeaderShell>
  );
}
