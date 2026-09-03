'use client';

import { useEffect, useRef } from 'react';

export function HowItWorks() {
  const stepsRef = useRef<HTMLDivElement>(null);
  
  const steps = [
    {
      number: 1,
      title: 'Create your household',
      description: 'Set up your shared space in seconds',
      emoji: '🏠',
      color: 'var(--v1-color-primary-green)',
      bgColor: 'var(--v1-color-accent-muted)',
    },
    {
      number: 2,
      title: 'Add items to your list',
      description: 'What do you need? Add it instantly',
      emoji: '🛒',
      color: 'var(--v1-color-secondary-orange)',
      bgColor: '#ffedd5',
    },
    {
      number: 3,
      title: 'Shop together',
      description: 'Real-time updates as you shop',
      emoji: '🤝',
      color: 'var(--v1-color-accent-yellow)',
      bgColor: 'var(--v1-color-warning-bg)',
    },
    {
      number: 4,
      title: 'Never forget again',
      description: 'Smart reminders for recurring items',
      emoji: '✨',
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

    const revealElements = stepsRef.current?.querySelectorAll('.v1-reveal-on-scroll');
    revealElements?.forEach((el, index) => {
      (el as HTMLElement).style.transitionDelay = `${index * 150}ms`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={stepsRef} className="v1-section" style={{ background: 'var(--v1-color-bg-secondary)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 
          className="v1-section-title v1-reveal-on-scroll"
          style={{ fontFamily: 'var(--v1-font-headings)' }}
        >
          How It Works
        </h2>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch">
          {steps.map((step, index) => (
            <div 
              key={step.number} 
              className="v1-card v1-reveal-on-scroll flex-1"
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                minHeight: '220px'
              }}
            >
              <div 
                className="v1-icon-circle mb-4 v1-animate-float"
                style={{ 
                  background: step.bgColor,
                  color: step.color,
                  animationDelay: `${index * 200}ms`
                }}
              >
                {step.emoji}
              </div>
              <div 
                className="absolute top-4 right-4 text-6xl font-extrabold opacity-10"
                style={{ fontFamily: 'var(--v1-font-headings)', color: step.color }}
              >
                {step.number}
              </div>
              <h3 
                className="text-xl font-bold mb-2 relative z-10"
                style={{ fontFamily: 'var(--v1-font-headings)', color: 'var(--v1-color-text)' }}
              >
                {step.title}
              </h3>
              <p 
                className="text-base relative z-10"
                style={{ fontFamily: 'var(--v1-font-body)', color: 'var(--v1-color-text-secondary)' }}
              >
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
