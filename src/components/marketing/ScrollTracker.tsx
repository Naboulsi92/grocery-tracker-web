'use client';

import { useEffect } from 'react';

export function ScrollTracker() {
  useEffect(() => {
    const handleScrollTracking = () => {
      const scrollDepth = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
      
      if ((window as any).plausible && [25, 50, 75, 100].includes(scrollDepth)) {
        (window as any).plausible('ScrollDepth', { props: { depth: scrollDepth } });
      }
    };

    window.addEventListener('scroll', handleScrollTracking);
    return () => window.removeEventListener('scroll', handleScrollTracking);
  }, []);

  return null;
}
