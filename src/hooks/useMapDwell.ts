import { useEffect } from 'react';
import { trackFeatureSignal } from '../api/featureUsage';

/**
 * How long the map has to be looked at before it counts as having been looked
 * at. Three seconds is long enough to exclude a tab passed through on the way
 * somewhere else, which is the whole point of the threshold.
 */
export const MAP_DWELL_MS = 3000;

/**
 * Count this install once it has had the campus map on screen for
 * {@link MAP_DWELL_MS} continuous, VISIBLE milliseconds.
 *
 * Mounted by both map surfaces — desktop `CampusMapView` and mobile
 * `MapScreen` — because they are independent components over the same
 * `MapCanvas`, and instrumenting one would have made the number silently
 * desktop-only. The admin console's own map (`AdminConsoleMap`) does not call
 * this: a society looking at its own events is not a student using the map.
 * The once-per-session latch lives in `api/featureUsage`, so mounting from two
 * places, or twice under StrictMode, still counts once.
 *
 * `visibilitychange` restarts rather than resumes: a backgrounded tab is not
 * being looked at, and a browser throttles its timers anyway, so counting the
 * time would count a student who walked away. Nothing about the map — no
 * building, no room, no event, not even how long past three seconds — is
 * recorded; see `api/featureUsage`.
 *
 * This is a timer over what is already on screen, not a data fetch, so the no-
 * `useEffect`-for-fetching rule does not apply.
 */
export function useMapDwell(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const start = () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        void trackFeatureSignal('map_dwell_3s');
      }, MAP_DWELL_MS);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
