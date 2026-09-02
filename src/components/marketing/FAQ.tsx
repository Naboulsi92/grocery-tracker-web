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
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                aria-expanded={openIndex === index}
              >
                <span className="font-semibold text-gray-900 dark:text-white pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
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
              {openIndex === index && (
                <div className="overflow-hidden animate-in fade-in duration-200">
                  <div className="p-4 sm:p-5 pt-0 text-gray-600 dark:text-gray-400">
                    {faq.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
