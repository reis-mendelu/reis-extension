import { useEffect, type RefObject } from 'react';

/** How long one notch owns a snapping strip: a wheel burst or a flick is one step. */
const STEP_LOCK_MS = 350;

/** Pixels per wheel unit: some mice report lines (a line taken as 16px) or pages. */
const unitPx = (e: WheelEvent, el: HTMLElement) =>
  e.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? el.clientWidth
      : 1;

/**
 * A vertical mouse wheel scrolls a sideways strip.
 *
 * A plain mouse wheel only scrolls vertically, and a strip with its scrollbar
 * hidden gives a mouse no other way across: on a Mac the phone's registered
 * exams (RegisteredStrip) past the first few were out of reach, and so were
 * the extension's exams past the edge of its timeline (ExamTimeline). Touch
 * swipes them, and a trackpad's sideways swipe already scrolls them, so both
 * are left to the browser, as is a pinch (ctrl+wheel).
 *
 * `tile` (default) for a strip that snaps: one tile per notch, by `scrollBy`.
 * The wheel's own pixels would not do there — a nudge smaller than half a tile
 * snapped straight back to where it was. Events inside the lock still keep the
 * page still, so a burst cannot scroll the page out from under the pointer.
 * `pixel` for one that does not: it follows the wheel.
 *
 * At either end the wheel is the page's again, so a strip under the pointer
 * never traps the scroll of the screen it sits in. `active` re-binds when the
 * strip mounts later than its owner (ExamTimeline's vertical layout has none).
 */
export function useWheelScrollsX(
  ref: RefObject<HTMLElement | null>,
  { mode = 'tile', active = true }: { mode?: 'tile' | 'pixel'; active?: boolean } = {}
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let lockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const forward = e.deltaY > 0;
      if ((forward && el.scrollLeft >= max - 1) || (!forward && el.scrollLeft <= 0)) return;
      e.preventDefault();
      if (mode === 'pixel') return el.scrollBy({ left: e.deltaY * unitPx(e, el) });
      const now = Date.now();
      if (now < lockedUntil) return;
      lockedUntil = now + STEP_LOCK_MS;
      const [a, b] = el.children as unknown as (HTMLElement | undefined)[];
      const step = a && b ? b.offsetLeft - a.offsetLeft : el.clientWidth;
      el.scrollBy({ left: forward ? step : -step, behavior: 'smooth' });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, mode, active]);
}
