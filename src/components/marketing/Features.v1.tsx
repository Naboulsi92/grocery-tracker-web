'use client';

import { useEffect, useRef } from 'react';

export function Features() {
  const featuresRef = useRef<HTMLDivElement>(null);
  
  const features = [
    {
      emoji: '⚡',
      title: 'Real-time sync',
      description: 'Changes update instantly for all household members',
      color: 'var(--v1-color-primary-green)',
      bgColor: 'var(--v1-color-accent-muted)',
    },
    {
      emoji: '📋',
      title: 'Shared lists',
      description: 'One list, multiple users - never buy duplicates',
      color: 'var(--v1-color-secondary-orange)',
      bgColor: '#ffedd5',
    },
    {
      emoji: '🔢',
      title: 'Smart quantities',
      description: 'Track amounts and get low-stock alerts',
      color: 'var(--v1-color-accent-yellow)',
      bgColor: 'var(--v1-color-warning-bg)',
    },
    {
      emoji: '🏷️',
      title: 'Categories',
      description: 'Organize by department for efficient shopping',
      color: 'var(--v1-color-primary-green)',
      bgColor: 'var(--v1-color-accent-muted)',
    },
  ];

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

    const revealElements = featuresRef.current?.querySelectorAll('.v1-reveal-on-scroll');
    revealElements?.forEach((el, index) => {
      (el as HTMLElement).style.transitionDelay = `${index * 100}ms`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={featuresRef} className="v1-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 
          className="v1-section-title v1-reveal-on-scroll"
          style={{ fontFamily: 'var(--v1-font-headings)' }}
        >
          Everything you need for shared shopping
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="v1-card v1-reveal-on-scroll"
              style={{ 
                minHeight: '180px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div 
                className="v1-icon-circle mb-4"
                style={{ 
                  background: feature.bgColor,
                  color: feature.color
                }}
              >
                {feature.emoji}
              </div>
              <h3 
                className="text-2xl font-bold mb-3"
                style={{ fontFamily: 'var(--v1-font-headings)', color: 'var(--v1-color-text)' }}
              >
                {feature.title}
              </h3>
              <p 
                className="text-base"
                style={{ fontFamily: 'var(--v1-font-body)', color: 'var(--v1-color-text-secondary)' }}
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
