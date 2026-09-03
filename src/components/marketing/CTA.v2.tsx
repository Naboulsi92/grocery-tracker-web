'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function CTAV2() {
  const { trackCtaClick } = usePlausibleAnalytics();
  const sectionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
            entry.target.classList.add('v2-animate-fade-in-up');
          }
        });
      },
      { threshold: 0.2 }
    );

    if (contentRef.current) {
      contentRef.current.style.opacity = '0';
      observer.observe(contentRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      id="cta-v2"
      className="v2-section"
      style={{ 
        padding: '4rem 1.5rem',
        background: 'var(--color-v2-primary-green)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div 
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.1) 0%, transparent 60%)',
          pointerEvents: 'none'
        }}
      />
      
      <div 
        ref={contentRef}
        className="v2-animate-fade-in-up"
        style={{ 
          opacity: '0',
          position: 'relative',
          zIndex: 1,
          maxWidth: '700px',
          margin: '0 auto',
          textAlign: 'center'
        }}
      >
        <div 
          style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            borderRadius: 'var(--v2-radius-full)',
            background: 'rgba(255,255,255,0.2)',
            marginBottom: '1.75rem'
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 5L25 17.5L37.5 17.5L27.5 27.5L32.5 40L20 32.5L7.5 40L12.5 27.5L2.5 17.5L15 17.5L20 5Z"
              fill="white"
              fillOpacity="0.9"
            />
          </svg>
        </div>

        <h2 
          style={{ 
            fontFamily: 'var(--font-v2-heading)', 
            fontWeight: 700, 
            fontSize: 'clamp(2rem, 4vw, 2.75rem)', 
            lineHeight: 1.2,
            color: '#ffffff',
            marginBottom: '1rem'
          }}
        >
          Ready to simplify your shopping?
        </h2>
        
        <p 
          style={{ 
            fontFamily: 'var(--font-v2-body)', 
            fontSize: '1.25rem', 
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.9)',
            marginBottom: '2rem'
          }}
        >
          Join thousands of households shopping smarter together
        </p>

        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1rem', 
            alignItems: 'center'
          }}
        >
          <Link
            href="/signup"
            data-cta-name="CTAV2_GetStarted"
            className="v2-focus-visible"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '1.25rem 2.5rem',
              background: '#ffffff',
              color: 'var(--color-v2-primary-green)',
              borderRadius: 'var(--v2-radius-sm)',
              fontFamily: 'var(--font-v2-body)',
              fontWeight: 700,
              fontSize: '1.125rem',
              textDecoration: 'none',
              transition: 'all var(--v2-transition-smooth)',
              boxShadow: 'var(--v2-shadow-md)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = 'var(--v2-shadow-lg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--v2-shadow-md)';
            }}
          >
            Get Started Free
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          
          <p 
            style={{ 
              fontFamily: 'var(--font-v2-body)', 
              fontSize: '0.9375rem',
              color: 'rgba(255,255,255,0.85)'
            }}
          >
            No credit card required • Free forever
          </p>
        </div>
      </div>
    </section>
  );
}
