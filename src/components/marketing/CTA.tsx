'use client';

import Link from 'next/link';
import { BrandIcon } from '@/components/BrandIcon';

export function CTA() {
  return (
    <section id="cta" className="mk-cta-section">
      <div className="mk-container">
        {/* an enlarged echo of the auth card: joining looks like the
            signup page */}
        <div className="mk-cta-card">
          <div className="mk-cta-tile" aria-hidden="true">
            <BrandIcon size={32} />
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
