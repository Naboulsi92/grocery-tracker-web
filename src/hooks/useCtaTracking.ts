'use client';

import { useEffect } from 'react';

/**
 * Data structure for CTA click tracking events.
 */
interface CtaClickData {
  /**
   * Unique name identifier for the CTA element
   */
  name: string;
  /**
   * HTML tag name of the clicked element
   */
  element: string;
  /**
   * Optional href attribute if the element is a link
   */
  href?: string;
}

/**
 * Options for configuring CTA click tracking.
 */
interface UseCtaTrackingOptions {
  /**
   * Callback function to handle CTA click events
   */
  trackCtaClick: (ctaData: CtaClickData) => void;
}

/**
 * Hook that tracks CTA (Call-to-Action) clicks across the application.
 * Listens for clicks on elements with data-cta-name attribute and calls
 * the provided tracking callback with element details.
 * 
 * @param options - Configuration options including the tracking callback
 * 
 * @example
 * ```tsx
 * const { trackCtaClick } = usePlausibleAnalytics();
 * useCtaTracking({ trackCtaClick });
 * 
 * // In your JSX:
 * <Link data-cta-name="Header_GetStarted" href="/signup">Get Started</Link>
 * ```
 */
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
