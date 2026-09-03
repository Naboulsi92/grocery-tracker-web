'use client';

import Link from 'next/link';

export function CTA() {
  return (
    <section id="cta" className="mk-cta-section">
      <div className="mk-container">
        {/* an enlarged echo of the auth card: joining looks like the
            signup page */}
        <div className="mk-cta-card">
          <div className="mk-cta-tile" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2>Ready to simplify your shopping?</h2>
          <p>
            Set up your household in seconds and invite everyone you shop with.
          </p>
          <Link href="/signup" data-cta-name="Bottom_GetStarted" className="mk-btn-primary">
            Get Started Free
          </Link>
          <p className="mk-cta-note">No credit card required</p>
        </div>
      </div>
    </section>
  );
}
