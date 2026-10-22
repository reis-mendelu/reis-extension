import { useEffect, useRef, type RefObject } from 'react';

/**
 * How long a Novinky question must stay on screen to count as seen. Novinky
 * opened and closed on the way to something else would otherwise count a
 * device that never read it. One threshold for every question on both trees,
 * so their shares mean the same thing.
 */
export const SEEN_DWELL_MS = 1500;

/**
 * Calls `onSeen` once the element has been at least half on screen, with the
 * page in the foreground, for {@link SEEN_DWELL_MS} without a break. An
 * observer reports geometry only, so a backgrounded tab is tracked separately,
 * as useMapDwell does for the map. Shared by the support question and the
 * console's questions (`SupportPrompt`, `QuestionRow`).
 */
export function useOnScreenDwell(ref: RefObject<Element | null>, onSeen: () => void): void {
  // The latest callback, without restarting the observer when it changes.
  const latest = useRef(onSeen);
  useEffect(() => {
    latest.current = onSeen;
  }, [onSeen]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let inView = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const sync = () => {
      if (!inView || document.visibilityState !== 'visible') return stop();
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        latest.current();
        io.disconnect();
        document.removeEventListener('visibilitychange', sync);
      }, SEEN_DWELL_MS);
    };
    const io = new IntersectionObserver(
      (entries) => {
        // `threshold` only decides WHEN the callback fires; a first report can
        // still be a thin slice with isIntersecting true, so check the ratio.
        inView = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5);
        sync();
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ref]);
}
