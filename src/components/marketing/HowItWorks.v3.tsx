'use client';

import { useEffect, useRef, useState } from 'react';

export function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: 'Create your household',
      description: 'Set up your shared space in seconds',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      number: 2,
      title: 'Add items to your list',
      description: 'What do you need? Add it instantly',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      number: 3,
      title: 'Shop together',
      description: 'Real-time updates as you shop',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      number: 4,
      title: 'Never forget again',
      description: 'Smart reminders for recurring items',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
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
    <section ref={sectionRef} className="v3-section" style={{ background: 'var(--v3-color-bg-secondary)' }}>
      <div className="v3-container">
        <div className="text-center mb-12">
          <h2 className="v3-heading-font v3-h2 text-[var(--v3-color-text)] mb-4">
            How It Works
          </h2>
          <p className="v3-body-lg text-[var(--v3-color-text-secondary)] max-w-2xl mx-auto">
            Get started in minutes with our simple workflow
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`flex-1 v3-card v3-card-elevated text-center ${isVisible ? 'v3-animate-fade-in-up' : 'opacity-0'}`}
              style={{ 
                transitionDelay: isVisible ? `${index * 150}ms` : '0ms',
                background: 'var(--v3-color-surface)'
              }}
            >
              <div className="relative inline-block mb-4">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center v3-icon-bounce"
                  style={{ 
                    background: 'var(--v3-color-primary)',
                    color: '#ffffff'
                  }}
                >
                  {step.icon}
                </div>
                <div 
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'var(--v3-color-accent)' }}
                >
                  {step.number}
                </div>
              </div>
              <h3 className="v3-heading-font v3-h3 text-[var(--v3-color-text)] mb-2">
                {step.title}
              </h3>
              <p className="v3-body text-[var(--v3-color-text-secondary)]">
                {step.description}
              </p>
              
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 -translate-y-1/2 z-0" 
                  style={{ 
                    width: 'calc(100% + 1.5rem)',
                    background: 'linear-gradient(90deg, var(--v3-color-primary) 0%, transparent 100%)'
                  }} 
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
