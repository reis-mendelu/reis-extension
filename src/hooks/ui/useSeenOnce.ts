import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element has come within `rootMargin` of the viewport, and true
 * from then on — scrolling it away again does not take it back.
 *
 * The implicit root (the viewport) on purpose: it is clipped by every scrolling
 * ancestor, so it is right whichever element actually scrolls — the extension
 * drawer's tab body or the phone sheet's SubjectDrawerScroller. An explicit
 * root that turned out not to clip would report every row visible at once.
 * Inside the extension's cross-origin iframe the browser ignores `rootMargin`
 * for the implicit root, so there a row counts only once it is on screen.
 *
 * Where IntersectionObserver does not exist, everything counts as seen.
 */
export function useSeenOnce(ref: RefObject<Element | null>, rootMargin = '200px 0px'): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          setSeen(true);
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, seen]);

  return seen;
}
