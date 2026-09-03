'use client';

import { useState } from 'react';

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

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="mk-section" id="faq">
      <div className="mk-container mk-faq">
        <h2 className="mk-h2">Frequently asked questions</h2>
        <p className="mk-section-sub">
          Everything else people usually ask before creating a household.
        </p>
        <div className="mk-faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="mk-faq-item">
              <button
                onClick={() => toggleFaq(index)}
                className="mk-faq-q"
                aria-expanded={openIndex === index}
              >
                <span>{faq.question}</span>
                <svg
                  className="mk-faq-chevron"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="mk-faq-a">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
