'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.plausible) return;

    const handleScroll = () => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      if (scrollDepth % 25 === 0 && scrollDepth > 0 && window.plausible) {
        window.plausible('scroll depth', { props: { depth: scrollDepth.toString() } });
      }
    };

    const handleCTAClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('a[href*="cta"]') ||
        target.closest('button.cta') ||
        target.closest('[data-cta]')
      ) {
        window.plausible?.('CTA click', { props: { element: target.tagName } });
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('click', handleCTAClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleCTAClick);
    };
  }, [pathname]);

  return null;
}