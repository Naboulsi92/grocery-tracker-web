'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/LanguageContext';
import { BrandIcon } from '@/components/BrandIcon';

interface AuthHeaderProps {
  showSignOut?: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * Floating back-home pill (ticket #197). Rendered at the auth-container
 * level (sibling of the card, next to ThemeToggle/LanguageToggle) — NEVER
 * inside `.auth-card.animate-fade-in`: its retained `translateY(0)` fill
 * becomes a containing block that traps `position: fixed` descendants.
 */
export function BackHomeLink() {
  const { t } = useI18n();

  return (
    <Link
      href="/"
      className="back-home-link"
      aria-label={t('auth.back_home')}
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
      <span>{t('auth.home')}</span>
    </Link>
  );
}

export function AuthHeader({ showSignOut = false, title, subtitle }: AuthHeaderProps) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();

  return (
    <div className="auth-header">
      <div className="auth-brand">
        <div className="auth-icon">
          <BrandIcon size={32} />
        </div>
        <div className="auth-title">
          <h1>{title || (user ? t('auth.welcome') : t('auth.default_title'))}</h1>
          <p className="text-muted">{subtitle || t('auth.default_subtitle')}</p>
        </div>
      </div>
      {showSignOut && user && (
        <button
          onClick={signOut}
          className="btn btn-ghost"
          aria-label={t('auth.sign_out')}
          data-testid="auth-header-sign-out-button"
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
          <span>{t('auth.sign_out')}</span>
        </button>
      )}
    </div>
  );
}