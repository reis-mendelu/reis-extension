import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element is on screen, and true from then on — scrolling it
 * away again does not take it back.
 *
 * The implicit root (the viewport) on purpose: intersection is clipped by every
 * scrolling ancestor, so it is right whichever element actually scrolls. That
 * differs per tree — the extension drawer's outer body scrolls the classmates
 * tab, the phone the tab's own box — and an explicit root that turned out not
 * to clip would report every row visible at once. No `rootMargin`: it grows
 * only the root, never an ancestor's clip, so it would prefetch nothing.
 *
 * Where IntersectionObserver does not exist, everything counts as seen.
 */
export function useSeenOnce(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        setSeen(true);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, seen]);

  return seen;
}
