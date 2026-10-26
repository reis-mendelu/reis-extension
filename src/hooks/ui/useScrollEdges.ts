import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether a horizontal scroller can still go back or forward, kept current on
 * scroll and resize. Off (`active` false) it measures nothing.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, active: boolean) {
  const [edges, setEdges] = useState({ back: false, forward: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = {
        back: max > 1 && el.scrollLeft > 1,
        forward: max > 1 && el.scrollLeft < max - 1,
      };
      setEdges((prev) => (prev.back === next.back && prev.forward === next.forward ? prev : next));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // The box resizing (a window resize) and its content changing (tiles
    // arriving with a sync) both move the edges.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [ref, active]);
  return edges;
}
