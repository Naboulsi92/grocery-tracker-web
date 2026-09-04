'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

const LIST_ITEMS = [
  { name: 'Lait', qty: '2 × 1 L' },
  { name: 'Pain', qty: '1' },
  { name: 'Œufs', qty: '6' },
  { name: 'Café', qty: '250 g' },
  { name: 'Pommes', qty: '4' },
];

export function Hero() {
  const { trackCtaClick } = usePlausibleAnalytics();
  // items check off one after another on load — the one orchestrated
  // motion moment on the page; skipped entirely under reduced motion
  const [doneCount, setDoneCount] = useState(0);

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleCtaClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const ctaElement = target.closest('[data-cta-name]') as HTMLElement | null;
      const ctaName = ctaElement?.getAttribute('data-cta-name');

      if (ctaName) {
        trackCtaClick({
          name: ctaName,
          element: target.tagName,
          href: (target as HTMLElement).getAttribute('href') || undefined,
        });
      }
    };

    document.addEventListener('click', handleCtaClick);
    return () => document.removeEventListener('click', handleCtaClick);
  }, [trackCtaClick]);

  useEffect(() => {
    const timers: number[] = [];
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      timers.push(window.setTimeout(() => setDoneCount(2), 0));
    } else {
      timers.push(window.setTimeout(() => setDoneCount(1), 900));
      timers.push(window.setTimeout(() => setDoneCount(2), 1700));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <div className="mk-container mk-hero">
      <div className="mk-hero-grid">
        <div className="mk-hero-copy">
          <h1>
            Collaborative grocery lists
            <br />
            <span data-testid="hero-households-text">for households</span>
          </h1>
          <p className="mk-hero-sub">
            Share one list with everyone you live with. Track quantities, sort by
            category, and see every change the moment it happens.
          </p>
          <div className="mk-hero-ctas">
            <Link href="/signup" data-cta-name="Hero_GetStarted" className="mk-btn-primary">
              Get Started
            </Link>
            <button onClick={scrollToFeatures} data-cta-name="Hero_LearnMore" className="mk-btn-secondary">
              Learn More
            </button>
          </div>
          <p className="mk-hero-note">Free for households of any size.</p>
        </div>

        {/* decorative artifact: the product's own shared list, styled as a
            sibling of the auth card */}
        <div className="mk-listcard" aria-hidden="true">
          <div className="mk-listcard-head">
            <span className="mk-listcard-title">Liste de courses</span>
            <span className="mk-avatars">
              <span className="mk-avatar">SR</span>
              <span className="mk-avatar">NA</span>
            </span>
          </div>
          <ul className="mk-list">
            {LIST_ITEMS.map((item, i) => {
              const isDone = i < doneCount;
              return (
                <li key={item.name} className={isDone ? 'mk-item is-done' : 'mk-item'}>
                  <span className="mk-check">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="mk-item-name">{item.name}</span>
                  <span className="mk-item-qty">{item.qty}</span>
                </li>
              );
            })}
          </ul>
          <div className="mk-item-adding">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Camille ajoute des pâtes…
          </div>
          <div className="mk-live">
            <span className="mk-live-dot" />
            Mis à jour à l&apos;instant
          </div>
        </div>
      </div>
    </div>
  );
}
