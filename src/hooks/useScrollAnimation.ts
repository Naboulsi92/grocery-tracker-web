'use client';

import { useEffect, useRef } from 'react';

/**
 * Options for configuring scroll-triggered animations.
 */
export interface UseScrollAnimationOptions {
  /**
   * Threshold for triggering animation (0-1). Default: 0.1
   */
  threshold?: number;
  /**
   * Margin around the root for triggering. Default: '0px'
   */
  rootMargin?: string;
  /**
   * Delay between staggered animations. Default: '0.15s'
   */
  staggerDelay?: string;
}

/**
 * Hook that triggers fade-in-up animations when elements scroll into view.
 * Uses IntersectionObserver to detect visibility and applies CSS animations
 * with optional staggering for multiple elements.
 * 
 * @param refs - Array of element refs to observe for scroll visibility
 * @param options - Configuration options for the animation behavior
 * 
 * @example
 * ```tsx
 * const ref1 = useRef<HTMLDivElement>(null);
 * const ref2 = useRef<HTMLDivElement>(null);
 * useScrollAnimation([ref1, ref2], { threshold: 0.2, staggerDelay: '0.2s' });
 * ```
 */
export function useScrollAnimation(
  refs: React.RefObject<HTMLElement>[],
  options: UseScrollAnimationOptions = {}
): void {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    staggerDelay = '0.15s'
  } = options;

  const animationStarted = useRef(false);

  useEffect(() => {
    if (animationStarted.current) return;
    animationStarted.current = true;

    const observerOptions = {
      threshold,
      rootMargin
    };

    const handleObserve = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('v2-animate-fade-in-up');
        }
      });
    };

    const observer = new IntersectionObserver(handleObserve, observerOptions);

    const elementsToObserve = refs
      .map((ref, index) => ({
        element: ref.current,
        index
      }))
      .filter(
        (item): item is { element: NonNullable<HTMLElement>; index: number } =>
          item.element !== null
      );

    elementsToObserve.forEach(({ element, index }) => {
      element.style.opacity = '0';
      element.style.animationDelay = `${index * parseFloat(staggerDelay)}s`;
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [threshold, rootMargin, staggerDelay, refs]);
}
