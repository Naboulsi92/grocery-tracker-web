'use client';

import { useCallback } from 'react';

interface PlausibleOptions {
  props: Record<string, string>;
}

interface CtaClickData {
  name: string;
  element: string;
  href?: string;
}

export function usePlausibleAnalytics() {
  const trackCtaClick = useCallback((ctaData: CtaClickData) => {
    if (typeof window === 'undefined') return;
    
    const plausible = (window as unknown as { plausible?: (eventName: string, options: PlausibleOptions) => void }).plausible;
    
    if (plausible) {
      plausible('CTAClick', {
        props: {
          name: ctaData.name,
          element: ctaData.element,
          href: ctaData.href || 'N/A',
        },
      });
    }
  }, []);

  return {
    trackCtaClick,
  };
}
