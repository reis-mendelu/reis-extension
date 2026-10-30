import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * An element's rendered height, kept current as the viewport changes. The week
 * grid needs pixels, not percentages, to know how many lines of a subject's
 * name fit in a block — clamping to whole lines instead of clipping one in half.
 */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
