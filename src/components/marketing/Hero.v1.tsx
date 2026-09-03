'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function Hero() {
  const { trackCtaClick } = usePlausibleAnalytics();
  const heroRef = useRef<HTMLDivElement>(null);

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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('v1-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const revealElements = heroRef.current?.querySelectorAll('.v1-reveal-on-scroll');
    revealElements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={heroRef} className="v1-section relative overflow-hidden" style={{ background: 'var(--v1-color-bg-cream)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Illustration */}
          <div className="v1-reveal-on-scroll text-center lg:text-left">
            <div className="v1-animate-float mb-6">
              <div 
                className="v1-icon-circle mx-auto lg:mx-0"
                style={{ background: 'var(--v1-color-accent-muted)', color: 'var(--v1-color-primary-green)' }}
              >
                🛒
              </div>
            </div>
            <h1 
              className="v1-reveal-on-scroll text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--v1-color-text-charcoal)] tracking-tight"
              style={{ fontFamily: 'var(--v1-font-headings)' }}
            >
              Collaborative grocery lists
              <span className="block text-[var(--v1-color-secondary-orange)] mt-2">for households</span>
            </h1>
            <p 
              className="v1-reveal-on-scroll mt-6 text-lg sm:text-xl text-[var(--v1-color-text-secondary)] max-w-xl mx-auto lg:mx-0"
              style={{ fontFamily: 'var(--v1-font-body)' }}
            >
              Never forget what to buy again. Share lists, manage quantities, and coordinate shopping with your household.
            </p>
            <div className="v1-reveal-on-scroll mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/signup"
                data-cta-name="Hero_v1_GetStarted"
                className="v1-btn v1-btn-primary"
              >
                Join Now
              </Link>
              <button
                onClick={scrollToFeatures}
                data-cta-name="Hero_v1_LearnMore"
                className="v1-btn v1-btn-secondary"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Right: App Screenshot Mockup */}
          <div className="v1-reveal-on-scroll flex justify-center lg:justify-end">
            <div 
              className="relative w-full max-w-md"
              style={{ animation: 'v1Float 4s ease-in-out infinite' }}
            >
              <div 
                className="rounded-2xl shadow-2xl overflow-hidden border-4 border-white"
                style={{ 
                  background: 'var(--v1-color-surface)',
                  boxShadow: 'var(--v1-shadow-xl)'
                }}
              >
                <div 
                  className="px-4 py-3 flex items-center gap-2"
                  style={{ background: 'var(--v1-color-primary-green)' }}
                >
                  <div className="w-3 h-3 rounded-full bg-white/30"></div>
                  <div className="w-3 h-3 rounded-full bg-white/30"></div>
                  <div className="w-3 h-3 rounded-full bg-white/30"></div>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    <div 
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--v1-color-accent-muted)' }}
                    >
                      <span className="text-2xl">🥛</span>
                      <div className="flex-1">
                        <div className="h-3 rounded w-24" style={{ background: 'var(--v1-color-text-muted)' }}></div>
                        <div className="h-2 rounded w-12 mt-1" style={{ background: 'var(--v1-color-text-muted)', opacity: 0.5 }}></div>
                      </div>
                    </div>
                    <div 
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--v1-color-warning-bg)' }}
                    >
                      <span className="text-2xl">🍞</span>
                      <div className="flex-1">
                        <div className="h-3 rounded w-20" style={{ background: 'var(--v1-color-text-muted)' }}></div>
                        <div className="h-2 rounded w-10 mt-1" style={{ background: 'var(--v1-color-text-muted)', opacity: 0.5 }}></div>
                      </div>
                    </div>
                    <div 
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--v1-color-accent-muted)', opacity: 0.5 }}
                    >
                      <span className="text-2xl">🥚</span>
                      <div className="flex-1">
                        <div className="h-3 rounded w-28" style={{ background: 'var(--v1-color-text-muted)' }}></div>
                        <div className="h-2 rounded w-14 mt-1" style={{ background: 'var(--v1-color-text-muted)', opacity: 0.5 }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div 
                className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full flex items-center justify-center text-4xl v1-animate-pulse"
                style={{ 
                  background: 'var(--v1-color-accent-yellow)',
                  boxShadow: 'var(--v1-shadow-lg)'
                }}
              >
                ✨
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
