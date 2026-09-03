'use client';

import { useEffect, useRef } from 'react';

export function FeaturesV2() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const features = [
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M24 14V24L30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Real-time Sync',
      description: 'Changes update instantly for all household members. Never wonder what was added or removed.',
      color: 'var(--color-v2-primary-green)'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="12" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M16 20V28M24 20V28M32 20V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      title: 'Shared Lists',
      description: 'One list, multiple users. Coordinate shopping without duplicates or confusion.',
      color: 'var(--color-v2-secondary-orange)'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M24 16V24L28 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="24" r="3" fill="currentColor" />
        </svg>
      ),
      title: 'Smart Quantities',
      description: 'Track amounts and get low-stock alerts. Know exactly when to restock.',
      color: 'var(--color-v2-accent-yellow)'
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 8L40 16V32L24 40L8 32V16L24 8Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M24 16V32M16 20L24 16L32 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: 'Categories',
      description: 'Organize by department for efficient shopping. Navigate stores like a pro.',
      color: 'var(--color-v2-primary-green)'
    }
  ];

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
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
    
    cardRefs.current.forEach((card) => {
      if (card) {
        card.style.opacity = '0';
        observer.observe(card);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      id="features-v2"
      className="v2-section"
      style={{ 
        padding: 'var(--v2-section-padding-y) var(--v2-section-padding-x)',
        background: 'var(--color-v2-bg-cream)'
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div 
          style={{ 
            textAlign: 'center', 
            marginBottom: '3rem',
            maxWidth: '700px',
            margin: '0 auto 3rem'
          }}
        >
          <h2 
            style={{ 
              fontFamily: 'var(--font-v2-heading)', 
              fontWeight: 600, 
              fontSize: 'clamp(2rem, 4vw, 2.75rem)', 
              lineHeight: 1.2,
              color: 'var(--color-v2-text-charcoal)',
              marginBottom: '1rem'
            }}
          >
            Everything you need for shared shopping
          </h2>
          <p 
            style={{ 
              fontFamily: 'var(--font-v2-body)', 
              fontSize: '1.125rem', 
              lineHeight: 1.7,
              color: 'var(--color-v2-text-muted)'
            }}
          >
            Thoughtfully designed features that make household shopping effortless and enjoyable.
          </p>
        </div>

        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: 'var(--v2-gap-md)'
          }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              ref={(el) => { cardRefs.current[index] = el; }}
              className="v2-card"
              style={{ 
                background: 'var(--color-v2-surface-white)',
                border: '1px solid var(--color-v2-border-subtle)',
                borderRadius: 'var(--v2-radius-md)',
                padding: 'var(--v2-card-padding)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                minHeight: '220px'
              }}
            >
              <div 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  borderRadius: 'var(--v2-radius-md)',
                  background: `${feature.color}20`,
                  color: feature.color,
                  marginBottom: '1.25rem'
                }}
              >
                {feature.icon}
              </div>
              <h3 
                style={{ 
                  fontFamily: 'var(--font-v2-heading)', 
                  fontWeight: 600, 
                  fontSize: '1.375rem', 
                  color: 'var(--color-v2-text-charcoal)',
                  marginBottom: '0.75rem'
                }}
              >
                {feature.title}
              </h3>
              <p 
                style={{ 
                  fontFamily: 'var(--font-v2-body)', 
                  fontSize: '1rem', 
                  lineHeight: 1.6,
                  color: 'var(--color-v2-text-muted)',
                  margin: 0
                }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
