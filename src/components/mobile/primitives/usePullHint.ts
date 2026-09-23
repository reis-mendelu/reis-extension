import { useEffect, type RefObject } from 'react';
import {
  PULL_HINT_DELAY_MS,
  PULL_HINT_DURATION_MS,
  pullHintContentKeyframes,
  pullHintIndicatorKeyframes,
} from './pullHint';

/**
 * Plays the pull hint once while `enabled`, and reports when it has played to
 * the end — the caller marks it seen, so it plays once ever, not once per
 * visit. Reported on FINISH, not start: marking it seen flips `enabled` off,
 * and that cleanup would cancel the hint a frame after it began. A hint that
 * never finished (a finger landed first) does not count, and tries next time.
 *
 * The Web Animations API rather than a CSS keyframe: the repo keeps app chrome
 * free of custom CSS, and this needs no stylesheet at all. It moves the
 * scroller's CONTENT, never the scroller — the day swipe owns the scroller's
 * transform, and an animation there would override it mid-gesture.
 *
 * It gives way to the student at every turn: not before the screen settles,
 * not if a finger has already landed, not unless the list is at its top, not
 * under reduced motion, and a touch mid-hint cancels it where it stands.
 */
export function usePullHint(
  scrollerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onPlayed: () => void
) {
  useEffect(() => {
    const scroller = scrollerRef.current;
    const indicator = indicatorRef.current;
    const content = scroller?.firstElementChild as HTMLElement | null | undefined;
    if (!enabled || !scroller || !indicator || !content) return;
    if (typeof content.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let touched = false;
    let running: Animation[] = [];
    const stop = () => {
      touched = true;
      clearTimeout(timer);
      running.forEach((a) => a.cancel());
      running = [];
    };
    const timer = setTimeout(() => {
      if (touched || scroller.scrollTop > 0) return;
      const opts = { duration: PULL_HINT_DURATION_MS };
      running = [
        content.animate(pullHintContentKeyframes(), opts),
        indicator.animate(pullHintIndicatorKeyframes(), opts),
      ];
      // A cancelled animation rejects `finished`; that is "not seen", not an error.
      running[0]!.finished.then(onPlayed, () => {});
    }, PULL_HINT_DELAY_MS);

    scroller.addEventListener('touchstart', stop, { passive: true });
    return () => {
      scroller.removeEventListener('touchstart', stop);
      stop();
    };
  }, [scrollerRef, indicatorRef, enabled, onPlayed]);
}
