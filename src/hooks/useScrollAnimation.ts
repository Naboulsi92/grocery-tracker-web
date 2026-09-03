'use client';

import { useEffect, useRef } from 'react';

export interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  staggerDelay?: string;
}

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
