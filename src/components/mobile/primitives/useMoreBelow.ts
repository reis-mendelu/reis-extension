import { useEffect, useState, type RefObject } from 'react';
import { hasMoreBelow } from './moreBelow';

/**
 * Whether the vertical scroller in `ref` still hides content below, kept
 * current on scroll and whenever its box or content changes size. The
 * vertical twin of `hooks/ui/useScrollEdges`, with the same observers.
 */
export function useMoreBelow(ref: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setMore(hasMoreBelow(el));
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // Profil's rows arrive after mount — ISIC, the study switcher, the admin
    // rows, the partner block — and a rotation or font load resizes them, so
    // a measurement at mount alone goes stale.
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    const observeBoxes = () => {
      ro?.disconnect();
      ro?.observe(el);
      for (const child of el.children) ro?.observe(child);
    };
    observeBoxes();
    const mo = new MutationObserver(() => {
      observeBoxes();
      measure();
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [ref]);
  return more;
}
