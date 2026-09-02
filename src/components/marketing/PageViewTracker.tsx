'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.plausible) {
      window.plausible('pageview', { props: { path: pathname } });
    }
  }, [pathname]);

  return null;
}