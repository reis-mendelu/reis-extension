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
 * A write over what is already on screen, not a data fetch, so the no-
 * `useEffect`-for-fetching rule does not apply (same as `useMapDwell`).
 */
export function useScreenSignal(signal: FeatureSignal, active = true): void {
  useEffect(() => {
    if (active) void trackFeatureSignal(signal);
  }, [signal, active]);
}
