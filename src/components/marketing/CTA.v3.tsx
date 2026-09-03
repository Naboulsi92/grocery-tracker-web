'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function CTA() {
  const { trackCtaClick } = usePlausibleAnalytics();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleCtaClick = () => {
    trackCtaClick({
      name: 'Bottom_GetStarted',
      element: 'BUTTON',
      href: '/signup',
    });
  };

  return (
    <section 
      ref={sectionRef} 
      className="v3-section relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, var(--v3-color-secondary) 0%, #c2410c 100%)'
      }}
    >
      <div className="absolute inset-0 opacity-10">
        <div 
          className="absolute top-10 left-10 w-32 h-32 rounded-full"
          style={{ background: '#ffffff' }}
        />
        <div 
          className="absolute bottom-10 right-10 w-40 h-40 rounded-full"
          style={{ background: '#ffffff' }}
        />
        <div 
          className="absolute top-1/2 left-1/4 w-24 h-24 rounded-full"
          style={{ background: '#fbbf24' }}
        />
      </div>

      <div className="v3-container relative z-10">
        <div 
          className={`text-center max-w-3xl mx-auto ${isVisible ? 'v3-animate-fade-in-up' : 'opacity-0'}`}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 v3-icon-bounce"
            style={{ background: 'rgba(255, 255, 255, 0.2)' }}
          >
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          
          <h2 className="v3-heading-font v3-h2 text-white mb-4">
            Ready to simplify your shopping?
          </h2>
          <p className="v3-body-lg text-white/90 mb-8">
            Join thousands of households shopping smarter together
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              data-cta-name="Bottom_GetStarted"
              onClick={handleCtaClick}
              className="v3-btn v3-btn-primary px-8 py-4 text-lg"
              style={{ 
                background: '#ffffff',
                color: 'var(--v3-color-secondary)'
              }}
            >
              Get Started Free
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <p className="text-white/80 v3-body-sm">
              No credit card required
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-white/70 v3-body-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Free forever
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              No setup required
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Works on all devices
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
