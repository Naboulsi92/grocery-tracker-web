'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function Hero() {
  const { trackCtaClick } = usePlausibleAnalytics();
  const [isVisible, setIsVisible] = useState(false);

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    setIsVisible(true);
    
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

  return (
    <section className="v3-section relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--v3-color-bg) 0%, var(--v3-color-bg-secondary) 100%)' }}>
      <div className="v3-container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div 
            className={`v3-body-font ${isVisible ? 'v3-animate-slide-in-left' : 'opacity-0'}`}
            style={{ transitionDelay: '0ms' }}
          >
            <h1 className="v3-heading-font v3-h1 text-[var(--v3-color-text)] mb-6">
              Collaborative grocery lists
              <span className="block text-[var(--v3-color-primary)] mt-2">for households</span>
            </h1>
            <p className="v3-body-lg text-[var(--v3-color-text-secondary)] mb-8 max-w-lg">
              Never forget what to buy again. Share lists, manage quantities, and coordinate shopping with your household.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                data-cta-name="Hero_GetStarted"
                className="v3-btn v3-btn-cta"
              >
                Join Now
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <button
                onClick={scrollToFeatures}
                data-cta-name="Hero_LearnMore"
                className="v3-btn v3-btn-secondary"
              >
                Learn More
              </button>
            </div>
          </div>

          <div 
            className={`relative ${isVisible ? 'v3-animate-slide-in-right' : 'opacity-0'}`}
            style={{ transitionDelay: '100ms' }}
          >
            <div className="relative">
              <div 
                className="v3-card v3-card-elevated p-6 relative z-10"
                style={{ 
                  background: 'var(--v3-color-surface)',
                  transform: 'rotate(-2deg)',
                  marginTop: '2rem'
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--v3-color-primary-light)' }}>
                    <svg className="w-6 h-6" style={{ color: 'var(--v3-color-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="v3-h3 text-[var(--v3-color-text)]">My Grocery List</p>
                    <p className="v3-body-sm text-[var(--v3-color-text-muted)]">Shared with family</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {['Milk 🥛', 'Bread 🍞', 'Eggs 🥚', 'Apples 🍎'].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--v3-color-bg-secondary)' }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: 'var(--v3-color-primary)' }}>
                        {idx < 2 && <div className="w-3 h-3 rounded-full" style={{ background: 'var(--v3-color-primary)' }} />}
                      </div>
                      <span className="v3-body text-[var(--v3-color-text)]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div 
                className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20"
                style={{ background: 'var(--v3-color-accent)' }}
              />
              <div 
                className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-20"
                style={{ background: 'var(--v3-color-primary)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
