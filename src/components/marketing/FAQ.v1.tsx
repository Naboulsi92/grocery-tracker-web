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
  const faqRef = useRef<HTMLDivElement>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

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

    const revealElements = faqRef.current?.querySelectorAll('.v1-reveal-on-scroll');
    revealElements?.forEach((el, index) => {
      (el as HTMLElement).style.transitionDelay = `${index * 100}ms`;
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={faqRef} className="v1-section">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 
          className="v1-section-title v1-reveal-on-scroll"
          style={{ fontFamily: 'var(--v1-font-headings)' }}
        >
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="v1-card v1-reveal-on-scroll"
              style={{ overflow: 'hidden' }}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--v1-color-focus)] focus:ring-inset rounded-lg"
                aria-expanded={openIndex === index}
                style={{ fontFamily: 'var(--v1-font-headings)' }}
              >
                <span 
                  className="font-bold text-lg pr-4 flex-1 text-left"
                  style={{ color: 'var(--v1-color-text)' }}
                >
                  {faq.question}
                </span>
                <svg
                  className={`w-6 h-6 flex-shrink-0 transition-transform duration-300 ml-4`}
                  style={{ 
                    color: 'var(--v1-color-primary-green)',
                    transform: openIndex === index ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ 
                  maxHeight: openIndex === index ? '200px' : '0',
                  opacity: openIndex === index ? 1 : 0
                }}
              >
                <div 
                  className="p-4 sm:p-5 pt-0 text-base"
                  style={{ fontFamily: 'var(--v1-font-body)', color: 'var(--v1-color-text-secondary)' }}
                >
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
