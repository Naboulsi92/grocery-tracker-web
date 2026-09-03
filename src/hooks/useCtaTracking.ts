'use client';

import { useEffect } from 'react';

interface CtaClickData {
  name: string;
  element: string;
  href?: string;
}

interface UseCtaTrackingOptions {
  trackCtaClick: (ctaData: CtaClickData) => void;
}

export function useCtaTracking({ trackCtaClick }: UseCtaTrackingOptions) {
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
}
