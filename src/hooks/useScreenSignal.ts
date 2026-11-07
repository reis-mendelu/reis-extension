import { useEffect } from 'react';
import { trackFeatureSignal, type FeatureSignal } from '../api/featureUsage';

/**
 * Count this install for a screen once that screen is SHOWN.
 *
 * `active` is for a surface that stays mounted while closed (the extension's
 * search overlay, the vývěska pin): it counts on the open transition, not on
 * mount. Everything else — how often, per session, per day — is
 * `trackFeatureSignal`'s latch and the database's one row per install per day,
 * so a student who opens Novinky twenty times is still one install that opened
 * it. Nothing about what was on the screen is recorded.
 *
 * A failed write is not retried while the screen stays open: the latch is
 * released, so the next time the screen is shown (most are remounted on every
 * open) counts again. Same as `useMapDwell`.
 *
 * A write over what is already on screen, not a data fetch, so the no-
 * `useEffect`-for-fetching rule does not apply (same as `useMapDwell`).
 */
export function useScreenSignal(signal: FeatureSignal, active = true, delayMs = 0): void {
  useEffect(() => {
    if (!active) return;
    if (delayMs <= 0) {
      void trackFeatureSignal(signal);
      return;
    }
    // `delayMs` is for a screen that can be on screen for a moment without
    // being chosen: the extension boots on the calendar, then restores the
    // saved view from IndexedDB. Unmounting before the delay cancels the count.
    const timer = setTimeout(() => void trackFeatureSignal(signal), delayMs);
    return () => clearTimeout(timer);
  }, [signal, active, delayMs]);
}
