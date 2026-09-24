import { useEffect, type RefObject } from 'react';
import { PULL_REFRESH_THRESHOLD_PX, pullClaims, pullIndicatorFrame } from './pullToRefresh';

export interface PullToRefreshConfig {
  /** The scroller the pull refreshes. It only arms while this is at its top. */
  scrollerRef: RefObject<HTMLElement | null>;
  /**
   * Where a pull may START, when that is more than the scroller: the calendar
   * passes its whole screen, so the date, the Now/Next card and the week strip
   * above the day pull too. Defaults to the scroller.
   */
  surfaceRef?: RefObject<HTMLElement | null>;
  /** The indicator, painted to follow the finger. Whether it SPINS is its owner's. */
  indicatorRef: RefObject<HTMLElement | null>;
  /** Called on a release past the threshold. Guarding a double refresh is its job. */
  onRefresh: () => void;
}

/**
 * Pull the scroller down from its top, let go past the threshold, and it
 * refreshes.
 *
 * TOUCH events, not pointer events, and that is the whole design. The agenda
 * is `touch-pan-y`, so a vertical drag belongs to the browser: it fires
 * `pointercancel` on the first frame it decides this is a pan, and a
 * pointer-based pull would die there the same way DayChips records the day
 * swipe dying. `touchmove` keeps arriving during a native pan, so the pull can
 * watch without taking anything. The listeners are all passive: nothing here
 * calls `preventDefault`, so iOS still rubber-bands the content under the
 * finger and the day swipe's own non-passive listener is left alone.
 *
 * The indicator is written straight to its node, never through state: a
 * render per touchmove is the jank DayBody and DayChips already measured and
 * designed out. Only the pull is painted here; the spinner that follows the
 * release is ordinary rendered state, once per refresh rather than per frame.
 */
export function usePullToRefresh({
  scrollerRef,
  surfaceRef,
  indicatorRef,
  onRefresh,
}: PullToRefreshConfig) {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const indicator = indicatorRef.current;
    // Touch events bubble, so one set of listeners on the surface also hears
    // every touch that starts inside the scroller.
    const surface = surfaceRef?.current ?? scroller;
    if (!scroller || !indicator || !surface) return;

    let start: { x: number; y: number } | null = null;
    let owned: boolean | null = null;
    let pull = 0;

    const paint = (dy: number | null) => {
      if (dy === null) {
        indicator.style.removeProperty('transition');
        indicator.style.removeProperty('opacity');
        indicator.style.removeProperty('transform');
        return;
      }
      const { opacity, y, deg } = pullIndicatorFrame(dy);
      indicator.style.transition = 'none';
      indicator.style.opacity = String(opacity);
      indicator.style.transform = `translateY(${y}px) rotate(${deg}deg)`;
    };
    const reset = () => {
      start = null;
      owned = null;
      pull = 0;
      paint(null);
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      // Armed only AT the top: otherwise a fling back up that keeps going
      // becomes a pull. A second finger is a pinch or a mistake, never a pull.
      if (e.touches.length !== 1 || !t || scroller.scrollTop > 0) return reset();
      start = { x: t.clientX, y: t.clientY };
      owned = null;
      pull = 0;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start) return;
      if (e.touches.length !== 1 || !t) return reset();
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (owned === null) {
        owned = pullClaims(dx, dy);
        if (owned === null) return;
        // A scroll or a day swipe. Forget it, so no later frame can reclaim it.
        if (!owned) return reset();
      }
      pull = dy;
      paint(dy);
    };
    const onEnd = () => {
      const pulled = owned === true && pull >= PULL_REFRESH_THRESHOLD_PX;
      reset();
      if (pulled) onRefresh();
    };

    surface.addEventListener('touchstart', onStart, { passive: true });
    surface.addEventListener('touchmove', onMove, { passive: true });
    surface.addEventListener('touchend', onEnd, { passive: true });
    surface.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      surface.removeEventListener('touchstart', onStart);
      surface.removeEventListener('touchmove', onMove);
      surface.removeEventListener('touchend', onEnd);
      surface.removeEventListener('touchcancel', reset);
    };
  }, [scrollerRef, surfaceRef, indicatorRef, onRefresh]);
}
