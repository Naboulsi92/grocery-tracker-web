'use client';

import { useState, useEffect, useRef } from 'react';

const faqs = [
  {
    question: 'Is this free?',
    answer: 'Yes! Our core features are completely free for households of any size.',
  },
  {
    question: 'How many people can join my household?',
    answer: 'Unlimited! Add all family members, roommates, or partners.',
  },
  {
    question: 'Do I need to download an app?',
    answer: 'No download needed - it works in your browser. But we have mobile apps too!',
  },
  {
    question: 'Can I share specific items only?',
    answer: 'Currently, households share the full list. Fine-grained sharing coming soon.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes! Your data is encrypted and only accessible to your household members.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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
            Frequently Asked Questions
          </h2>
          <p className="v3-body-lg text-[var(--v3-color-text-secondary)] max-w-2xl mx-auto">
            Everything you need to know about our service
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`v3-card v3-card-elevated ${isVisible ? 'v3-animate-fade-in-up' : 'opacity-0'}`}
              style={{ 
                transitionDelay: isVisible ? `${index * 100}ms` : '0ms',
                background: 'var(--v3-color-surface)',
                padding: '0'
              }}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-5 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--v3-color-primary)] focus:ring-inset rounded-lg"
                aria-expanded={openIndex === index}
              >
                <span className="v3-heading-font v3-h3 text-[var(--v3-color-text)] pr-4 flex-1 text-left">
                  {faq.question}
                </span>
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300"
                  style={{ 
                    background: openIndex === index ? 'var(--v3-color-primary)' : 'var(--v3-color-bg-secondary)',
                    color: openIndex === index ? '#ffffff' : 'var(--v3-color-text-muted)',
                    transform: `rotate(${openIndex === index ? 180 : 0}deg)`
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ 
                  maxHeight: openIndex === index ? '200px' : '0',
                  opacity: openIndex === index ? 1 : 0
                }}
              >
                <div className="p-5 pt-0 text-[var(--v3-color-text-secondary)] v3-body">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
