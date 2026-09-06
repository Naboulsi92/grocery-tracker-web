'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface AuthHeaderProps {
  showBackHome?: boolean;
  showSignOut?: boolean;
  title?: string;
  subtitle?: string;
}

export function AuthHeader({ showBackHome = false, showSignOut = false, title, subtitle }: AuthHeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="auth-header">
      <div className="auth-brand">
        {showBackHome && (
          <Link
            href="/"
            className="back-home-link"
            aria-label="Retour à l'accueil"
            data-testid="back-home-link"
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
            <span>Accueil</span>
          </Link>
        )}
        <div className="auth-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>
        <div className="auth-title">
          <h1>{title || (user ? 'Bienvenue' : 'Connexion')}</h1>
          <p className="text-muted">{subtitle || 'Accédez à votre liste de courses'}</p>
        </div>
      </div>
      {showSignOut && user && (
        <button
          onClick={signOut}
          className="btn btn-ghost"
          aria-label="Déconnexion"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Déconnexion</span>
        </button>
      )}
    </div>
  );
}