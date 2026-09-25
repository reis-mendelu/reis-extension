import { useEffect, type RefObject } from 'react';
import { BACK, BACK_MS, DOWN, DOWN_MS, PULL_DEPTH_PX } from './pullHint';

/**
 * While a refresh runs, hold the list down with the spinner turning in the gap,
 * and spring it back when the refresh answers — the native refresh look.
 *
 * It is what makes a refresh visible rather than merely true: on exams one
 * starts on every visit, and this is how the student sees it happen. It also
 * keeps the spinner in space of its own instead of over the first row.
 *
 * The same depth and easings as the pull hint, so the hint, a real pull and a
 * refresh all move the list the same way. The CONTENT moves, never the
 * scroller, for the reason usePullHint gives. Nothing moves under reduced
 * motion; the spinner still turns.
 */
export function useRefreshHold(scrollerRef: RefObject<HTMLElement | null>, refreshing: boolean) {
  useEffect(() => {
    const content = scrollerRef.current?.firstElementChild as HTMLElement | null | undefined;
    if (!refreshing || !content || typeof content.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const held = `translateY(${PULL_DEPTH_PX}px)`;
    const hold = content.animate([{ transform: 'translateY(0)' }, { transform: held }], {
      duration: DOWN_MS,
      easing: DOWN,
      fill: 'forwards',
    });
    return () => {
      // From wherever the hold had got to: a refresh that answers inside the
      // 380ms descent must not snap to the bottom before springing back.
      const from = getComputedStyle(content).transform;
      hold.cancel();
      if (typeof content.animate !== 'function') return;
      content.animate(
        [{ transform: from && from !== 'none' ? from : held }, { transform: 'translateY(0)' }],
        { duration: BACK_MS, easing: BACK }
      );
    };
  }, [scrollerRef, refreshing]);
}
