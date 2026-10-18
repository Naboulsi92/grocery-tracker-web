'use client';

import { useEffect } from 'react';

/**
 * Foreground OS-badge resync (ticket #247; contract of the SW path #223):
 * counts only come from exact full-fetch cycles, so an approximate count
 * never overwrites a correct push-delivered badge. `null` means "no data
 * yet" and touches nothing. A rejected badge call is swallowed. No unmount
 * reset: the OS badge keeps the last known truth until the next update or
 * push, exactly like the service-worker path.
 */
export function useAppBadgeSync(count: number | null): void {
  useEffect(() => {
    if (count === null) return;
    if (!Number.isInteger(count) || count < 0) return;
    if (count > 0) {
      if (typeof navigator.setAppBadge === 'function') {
        void Promise.resolve(navigator.setAppBadge(count)).catch(() => {});
      }
    } else if (typeof navigator.clearAppBadge === 'function') {
      void Promise.resolve(navigator.clearAppBadge()).catch(() => {});
    }
  }, [count]);
}
