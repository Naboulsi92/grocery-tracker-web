'use client';

import { useRef } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

export function HowItWorksV2() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useScrollAnimation(
    [...stepRefs.current, ...lineRefs.current].map(r => ({ current: r as HTMLElement })) as React.RefObject<HTMLElement>[],
    { threshold: 0.15, staggerDelay: '0.15s' }
  );

  const steps = [
    {
      number: 1,
      title: 'Create your household',
      description: 'Set up your shared space in seconds',
      illustration: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <path d="M40 10L70 25V55L40 70L10 55V25L40 10Z" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M40 25V55M25 35L40 25L55 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="40" cy="45" r="8" fill="currentColor" fillOpacity="0.2" />
        </svg>
      )
    },
    {
      number: 2,
      title: 'Add items to your list',
      description: 'What do you need? Add it instantly',
      illustration: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="15" y="15" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M28 30H52M28 40H52M28 50H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="58" cy="22" r="4" fill="currentColor" />
        </svg>
      )
    },
    {
      number: 3,
      title: 'Shop together',
      description: 'Real-time updates as you shop',
      illustration: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="28" cy="35" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M28 47V58M22 52H34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="52" cy="35" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M52 47V58M46 52H58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M35 35L45 35" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      )
    },
    {
      number: 4,
      title: 'Never forget again',
      description: 'Smart reminders for recurring items',
      illustration: (
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="35" r="15" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M40 30V35L45 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M25 55C28 50 35 48 40 48C45 48 52 50 55 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  return (
    <section 
      ref={sectionRef}
      className="v2-section"
      style={{ 
        padding: 'var(--v2-section-padding-y) var(--v2-section-padding-x)',
        background: 'var(--color-v2-surface-white)'
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div 
          style={{ 
            textAlign: 'center', 
            marginBottom: '3rem',
            maxWidth: '700px',
            margin: '0 auto 3.5rem'
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
            How It Works
          </h2>
          <p 
            style={{ 
              fontFamily: 'var(--font-v2-body)', 
              fontSize: '1.125rem', 
              lineHeight: 1.7,
              color: 'var(--color-v2-text-muted)'
            }}
          >
            Get started in moments and shop smarter together.
          </p>
        </div>

        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '2rem',
            alignItems: 'center'
          }}
        >
          {steps.map((step, index) => (
            <div 
              key={step.number}
              ref={(el) => { stepRefs.current[index] = el; }}
              style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                maxWidth: '500px'
              }}
            >
              <div 
                style={{ 
                  display: 'flex',
                  gap: '1.5rem',
                  alignItems: 'center',
                  width: '100%'
                }}
              >
                <div 
                  style={{ 
                    flex: '0 0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <div 
                    style={{ 
                      width: '72px',
                      height: '72px',
                      borderRadius: 'var(--v2-radius-full)',
                      background: 'var(--color-v2-primary-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      boxShadow: 'var(--v2-shadow-md)'
                    }}
                  >
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div 
                      ref={(el) => { lineRefs.current[index] = el; }}
                      style={{ 
                        width: '3px',
                        height: '48px',
                        background: 'var(--color-v2-border)',
                        opacity: '0'
                      }}
                    />
                  )}
                </div>

                <div 
                  style={{ 
                    flex: 1,
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'flex-start',
                    padding: '1.25rem',
                    background: 'var(--color-v2-bg-cream)',
                    borderRadius: 'var(--v2-radius-md)',
                    border: '1px solid var(--color-v2-border-subtle)'
                  }}
                >
                  <div 
                    style={{ 
                      color: 'var(--color-v2-primary-green)',
                      flex: '0 0 auto'
                    }}
                  >
                    {step.illustration}
                  </div>
                  <div>
                    <h3 
                      style={{ 
                        fontFamily: 'var(--font-v2-heading)', 
                        fontWeight: 600, 
                        fontSize: '1.25rem', 
                        color: 'var(--color-v2-text-charcoal)',
                        marginBottom: '0.5rem'
                      }}
                    >
                      {step.title}
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
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
