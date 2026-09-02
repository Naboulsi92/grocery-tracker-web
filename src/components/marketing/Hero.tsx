'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePlausibleAnalytics } from '@/hooks/usePlausibleAnalytics';

export function Hero() {
  const { trackCtaClick } = usePlausibleAnalytics();

  const scrollToFeatures = () => {
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleCtaClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const ctaElement = target.closest('[data-cta-name]') as HTMLElement | null;
      const ctaName = ctaElement?.getAttribute('data-cta-name');
      
      if (ctaName) {
        trackCtaClick({
          name: ctaName,
          element: target.tagName,
          href: (target as HTMLElement).getAttribute('href') || undefined,
        });
      }
    };

    document.addEventListener('click', handleCtaClick);
    return () => document.removeEventListener('click', handleCtaClick);
  }, [trackCtaClick]);

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
            Collaborative grocery lists
            <br />
            <span className="text-blue-600 dark:text-blue-400">for households</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Never forget what to buy again. Share lists, manage quantities, and coordinate shopping with your household.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              data-cta-name="Hero_GetStarted"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started
            </Link>
            <button
              onClick={scrollToFeatures}
              data-cta-name="Hero_LearnMore"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
