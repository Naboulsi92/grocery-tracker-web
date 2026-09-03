'use client';

import { useEffect, useRef, useState } from 'react';

export function Features() {
  const features = [
    {
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Real-time sync',
      description: 'Changes update instantly for all household members',
      color: '#15803d',
    },
    {
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'Shared lists',
      description: 'One list, multiple users - never buy duplicates',
      color: '#ea580c',
    },
    {
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      title: 'Smart quantities',
      description: 'Track amounts and get low-stock alerts',
      color: '#fbbf24',
    },
    {
      icon: (
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      title: 'Categories',
      description: 'Organize by department for efficient shopping',
      color: '#15803d',
    },
  ];

  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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

  return (
    <section ref={sectionRef} className="v3-section" style={{ background: 'var(--v3-color-bg)' }}>
      <div className="v3-container">
        <div className="text-center mb-12">
          <h2 className="v3-heading-font v3-h2 text-[var(--v3-color-text)] mb-4">
            Everything you need for shared shopping
          </h2>
          <p className="v3-body-lg text-[var(--v3-color-text-secondary)] max-w-2xl mx-auto">
            Powerful features designed for modern households
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`v3-card v3-card-elevated ${isVisible ? 'v3-animate-fade-in-up' : 'opacity-0'}`}
              style={{ 
                transitionDelay: isVisible ? `${index * 100}ms` : '0ms',
                background: 'var(--v3-color-surface)'
              }}
            >
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 v3-icon-bounce"
                style={{ 
                  background: `${feature.color}15`,
                  color: feature.color
                }}
              >
                {feature.icon}
              </div>
              <h3 className="v3-heading-font v3-h3 text-[var(--v3-color-text)] mb-3">
                {feature.title}
              </h3>
              <p className="v3-body text-[var(--v3-color-text-secondary)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
