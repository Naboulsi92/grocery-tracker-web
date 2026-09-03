'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    plausible?: (eventName: string, options: { props: Record<string, string> }) => void;
  }
}

export function ScrollTracker() {
  useEffect(() => {
    const handleScrollTracking = () => {
      const scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      
      if (window.plausible && [25, 50, 75, 100].includes(scrollDepth)) {
        window.plausible('ScrollDepth', { props: { depth: scrollDepth.toString() } });
      }
    };

    window.addEventListener('scroll', handleScrollTracking);
    return () => window.removeEventListener('scroll', handleScrollTracking);
  }, []);

  return null;
}
