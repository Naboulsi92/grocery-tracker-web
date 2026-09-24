'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { BrandIcon } from '@/components/BrandIcon';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Ticket #48 : session-aware header. While resolving, keep the anonymous
  // links (no flash for visitors); once signed in, offer the dashboard.
  const { user, loading } = useAuth();
  const signedIn = !loading && user !== null;

  return (
    <header className="mk-header">
      <nav className="mk-nav">
        <Link href="/" className="mk-brand">
          <span className="mk-brand-tile" aria-hidden="true">
            <BrandIcon size={18} />
          </span>
          Grocery List
        </Link>

        <div className="mk-nav-links">
          {signedIn ? (
            <Link href="/home" className="mk-nav-cta" data-testid="mk-dashboard-link">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="mk-nav-link">
                Login
              </Link>
              <Link href="/signup" className="mk-nav-cta">
                Signup
              </Link>
            </>
          )}
        </div>

        <div className="mk-nav-end">
          <LanguageToggle />
          <ThemeToggle />
          <button
            className="mk-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mk-mobile-menu">
          {signedIn ? (
            <Link
              href="/home"
              className="mk-nav-link"
              onClick={() => setMobileMenuOpen(false)}
              data-testid="mk-dashboard-link-mobile"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="mk-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="mk-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Signup
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
