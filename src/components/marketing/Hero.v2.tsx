'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function HeroV2() {
  const { trackCtaClick } = usePlausibleAnalytics();
  const heroRef = useRef<HTMLDivElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const ctaContainerRef = useRef<HTMLDivElement>(null);

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features-v2');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2,
      rootMargin: '0px'
    };

    const handleObserve = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('v2-animate-fade-in-up');
        }
      });
    };

    const observer = new IntersectionObserver(handleObserve, observerOptions);
    
    const elementsToObserve = [
      illustrationRef.current,
      headlineRef.current,
      descriptionRef.current,
      ctaContainerRef.current
    ].filter((el): el is NonNullable<typeof el> => el !== null);

    elementsToObserve.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.animationDelay = `${index * 0.15}s`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

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

  return (
    <section ref={heroRef} className="relative overflow-hidden v2-section" style={{ padding: '4rem 1.5rem 6rem' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <div 
            ref={illustrationRef}
            className="v2-animate-fade-in-up"
            style={{ opacity: '0', marginBottom: '2rem' }}
          >
            <div 
              className="v2-card"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                padding: '2rem',
                maxWidth: '400px',
                margin: '0 auto',
                background: 'linear-gradient(135deg, var(--color-v2-accent-yellow) 0%, #fbbf24 100%)'
              }}
            >
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M60 10L70 35L95 35L75 55L85 80L60 65L35 80L45 55L25 35L50 35L60 10Z"
                  fill="white"
                  fillOpacity="0.9"
                />
                <circle cx="60" cy="60" r="25" fill="white" fillOpacity="0.8" />
                <path
                  d="M60 45V75M45 60H75"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <h1 
            ref={headlineRef}
            className="v2-animate-fade-in-up"
            style={{ opacity: '0', marginBottom: '1.5rem' }}
          >
            <span style={{ fontFamily: 'var(--font-v2-heading)', fontWeight: 700, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.1, color: 'var(--color-v2-text-charcoal)' }}>
              Grocery Shopping,
            </span>
            <br />
            <span 
              style={{ 
                fontFamily: 'var(--font-v2-heading)', 
                fontWeight: 400, 
                fontStyle: 'italic',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                color: 'var(--color-v2-primary-green)'
              }}
            >
              Simplified Together
            </span>
          </h1>

          <p 
            ref={descriptionRef}
            className="v2-animate-fade-in-up"
            style={{ opacity: '0', maxWidth: '600px', margin: '0 auto 2.5rem', fontFamily: 'var(--font-v2-body)', fontSize: '1.25rem', lineHeight: 1.7, color: 'var(--color-v2-text-muted)' }}
          >
            Coordinate your household shopping with elegance. Real-time lists, smart quantities, and seamless collaboration for modern families.
          </p>

          <div 
            ref={ctaContainerRef}
            className="v2-animate-fade-in-up"
            style={{ opacity: '0', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <Link
                href="/signup"
                data-cta-name="HeroV2_GetStarted"
                className="v2-btn-primary"
                style={{ minWidth: '180px' }}
              >
                Join Now
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <button
                onClick={scrollToFeatures}
                data-cta-name="HeroV2_LearnMore"
                className="v2-btn-secondary"
                style={{ minWidth: '180px' }}
              >
                Explore Features
              </button>
            </div>
            <p style={{ fontFamily: 'var(--font-v2-body)', fontSize: '0.875rem', color: 'var(--color-v2-text-muted)', marginTop: '0.5rem' }}>
              Free forever for households • No credit card required
            </p>
          </div>
        </div>
      </div>

      <div 
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: -1
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle at 50% 50%, rgba(21, 128, 61, 0.03) 0%, transparent 50%)'
          }}
        />
      </div>
    </section>
  );
}
