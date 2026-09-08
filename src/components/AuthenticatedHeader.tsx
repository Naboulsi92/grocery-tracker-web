'use client';

import { BrandIcon } from '@/components/BrandIcon';
import type { Household } from '@/hooks/useHousehold';

interface AuthenticatedHeaderProps {
  showBackLink?: boolean;
  onBackLinkClick?: () => void;
  trailingAction?: React.ReactNode;
  household?: Household | null;
  loading?: boolean;
  error?: string;
}

export function AuthenticatedHeader({ showBackLink = false, onBackLinkClick, trailingAction, household, loading = false, error }: AuthenticatedHeaderProps) {
  const backLink = showBackLink ? (
    <button
      className="back-link"
      aria-label="Retour à l'accueil"
      onClick={onBackLinkClick ?? (() => window.history.back())}
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
  ) : null;

  if (loading) {
    return (
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon" aria-hidden="true">
              <BrandIcon />
            </div>
            {backLink}
            <h1>Chargement...</h1>
          </div>
        </div>
      </header>
    );
  }

  if (error) {
    return (
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon" aria-hidden="true">
              <BrandIcon />
            </div>
            {backLink}
            <h1>Erreur</h1>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-brand">
            <div className="brand-icon" aria-hidden="true">
              <BrandIcon />
            </div>
            {backLink}
            <h1>{household?.name || 'Mon foyer'}</h1>
        </div>
        {trailingAction}
      </div>
    </header>
  );
}