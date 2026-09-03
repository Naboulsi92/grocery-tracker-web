'use client';

import { useState, useEffect, useRef } from 'react';

const faqs = [
  {
    question: 'Is this free?',
    answer: 'Yes! Our core features are completely free for households of any size. We believe shopping together should be accessible to everyone.'
  },
  {
    question: 'How many people can join my household?',
    answer: 'Unlimited! Add all family members, roommates, or partners. There are no restrictions on household size.'
  },
  {
    question: 'Do I need to download an app?',
    answer: 'No download needed - it works beautifully in your browser. But we also offer mobile apps if you prefer native experiences.'
  },
  {
    question: 'Can I share specific items only?',
    answer: 'Currently, households share the full list. Fine-grained item-level sharing is on our roadmap for future releases.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. Your data is encrypted at rest and in transit. Only your household members can access your lists and information.'
  },
  {
    question: 'What happens if someone leaves my household?',
    answer: 'They lose access immediately. You can review and manage household members at any time from your settings.'
  }
];

export function FAQV2() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Setup IntersectionObserver to trigger fade-in animations when FAQ items come into view
  // Each item gets a staggered delay based on its index for a cascading effect
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
    
    faqRefs.current.forEach((faq, index) => {
      if (faq) {
        faq.style.opacity = '0';
        faq.style.animationDelay = `${index * 0.1}s`;
        observer.observe(faq);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="v2-section"
      style={{ 
        padding: 'var(--v2-section-padding-y) var(--v2-section-padding-x)',
        background: 'var(--color-v2-bg-cream)'
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div 
          style={{ 
            textAlign: 'center', 
            marginBottom: '3rem',
            maxWidth: '600px',
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
            Frequently Asked Questions
          </h2>
          <p 
            style={{ 
              fontFamily: 'var(--font-v2-body)', 
              fontSize: '1.125rem', 
              lineHeight: 1.7,
              color: 'var(--color-v2-text-muted)'
            }}
          >
            Everything you need to know about getting started.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                ref={(el) => { faqRefs.current[index] = el; }}
                className="v2-card"
                style={{ 
                  background: 'var(--color-v2-surface-white)',
                  border: '1px solid var(--color-v2-border-subtle)',
                  borderRadius: 'var(--v2-radius-md)',
                  overflow: 'hidden'
                }}
              >
                <button
                  id={`faq-question-${index}`}
                  onClick={() => toggleFaq(index)}
                  className="v2-focus-visible"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '1.25rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span 
                    style={{ 
                      fontFamily: 'var(--font-v2-heading)', 
                      fontWeight: 600, 
                      fontSize: '1.125rem',
                      color: 'var(--color-v2-text-charcoal)',
                      flex: 1
                    }}
                  >
                    {faq.question}
                  </span>
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{
                      color: 'var(--color-v2-primary-green)',
                      flex: '0 0 auto',
                      transition: `transform var(--v2-transition-smooth)`,
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  >
                    <path
                      d="M6 9L12 15L18 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  style={{
                    overflow: 'hidden',
                    transition: `max-height var(--v2-transition-smooth), opacity var(--v2-transition-smooth)`,
                    maxHeight: isOpen ? '500px' : '0',
                    opacity: isOpen ? 1 : 0
                  }}
                >
                  <div 
                    style={{
                      padding: '0 1.25rem 1.25rem',
                      color: 'var(--color-v2-text-muted)',
                      fontFamily: 'var(--font-v2-body)',
                      fontSize: '1rem',
                      lineHeight: 1.6
                    }}
                  >
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
