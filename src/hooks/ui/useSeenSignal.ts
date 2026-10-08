import { useCallback, useRef } from 'react';
import { trackEventSignal } from '../../api/eventSignals';

/**
 * A ref callback that counts a society event as Seen once at least half of the
 * element is on screen (spec 2026-10-08). `trackEventSignal` dedupes per
 * device, so a row scrolled past twice, or shown on two surfaces, counts once.
 * `null` observes nothing (an empty peek band, the admin console's own list).
 */
export function useSeenSignal<T extends Element>(eventId: string | null) {
  const observer = useRef<IntersectionObserver | null>(null);
  return useCallback(
    (el: T | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!el || !eventId) return;
      const obs = new IntersectionObserver(
        (entries) => {
          // isIntersecting alone is true for any sliver; Seen is half or more.
          if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
            void trackEventSignal(eventId, 'seen');
            obs.disconnect();
          }
        },
        { threshold: 0.5 }
      );
      obs.observe(el);
      observer.current = obs;
    },
    [eventId]
  );
}
