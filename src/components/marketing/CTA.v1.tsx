'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export function CTA() {
  const ctaRef = useRef<HTMLDivElement>(null);

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

    if (ctaRef.current) {
      observer.observe(ctaRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={ctaRef} 
      className="v1-section v1-reveal-on-scroll relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, var(--v1-color-secondary-orange) 0%, #c2410c 100%)'
      }}
    >
      {/* Decorative elements */}
      <div 
        className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-20"
        style={{ 
          background: 'var(--v1-color-accent-yellow)',
          transform: 'translate(-50%, -50%)'
        }}
      ></div>
      <div 
        className="absolute bottom-0 right-0 w-40 h-40 rounded-full opacity-20"
        style={{ 
          background: 'var(--v1-color-accent-muted)',
          transform: 'translate(50%, 50%)'
        }}
      ></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="v1-icon-circle mx-auto mb-6 v1-animate-float" style={{ 
          background: 'var(--v1-color-accent-yellow)',
          color: 'var(--v1-color-text-charcoal)'
        }}>
          🎉
        </div>
        <h2 
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4 text-white"
          style={{ fontFamily: 'var(--v1-font-headings)' }}
        >
          Ready to simplify your shopping?
        </h2>
        <p 
          className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto text-white/90"
          style={{ fontFamily: 'var(--v1-font-body)' }}
        >
          Join thousands of households shopping smarter together
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/signup"
            data-cta-name="Bottom_v1_GetStarted"
            className="v1-btn v1-btn-primary"
            style={{ 
              background: 'var(--v1-color-surface-white)',
              color: 'var(--v1-color-secondary-orange)'
            }}
          >
            Get Started Free
          </Link>
          <p 
            className="text-white/80 text-sm"
            style={{ fontFamily: 'var(--v1-font-body)' }}
          >
            No credit card required
          </p>
        </div>
      </div>
    </section>
  );
}
