import { useEffect, useRef } from 'react';
import type L from 'leaflet';
import { subscribeMapInstance } from './mapInstance';
import { trackEventSignal } from '../../api/eventSignals';
import type { VenueGroup } from './eventHelpers';

/**
 * A pin counts as Seen when it is inside the visible map bounds (spec
 * 2026-10-08) — checked when the camera settles and when the pins change. The
 * caller passes `enabled: false` while authoring in the console or inside a
 * building, where pins are hidden. The map itself is mounted only while its
 * tab (phone) or view (desktop) is shown, so a background tab counts nothing.
 */
export function usePinsSeen(groups: VenueGroup[], enabled: boolean): void {
  // Seeded with the first render's values; later ones arrive in the effect
  // below (never written during render).
  const state = useRef({ groups, enabled });
  const check = useRef<(() => void) | null>(null);

  useEffect(() => {
    let map: L.Map | null = null;
    const run = () => {
      const { groups: gs, enabled: on } = state.current;
      if (!map || !on) return;
      const bounds = map.getBounds();
      for (const g of gs) {
        if (!bounds.contains([g.coord[1], g.coord[0]])) continue;
        for (const e of g.events) void trackEventSignal(e.id, 'seen');
      }
    };
    check.current = run;
    const unsub = subscribeMapInstance((m) => {
      map?.off('moveend', run);
      map = m;
      map?.on('moveend', run);
      run();
    });
    return () => {
      map?.off('moveend', run);
      unsub();
      check.current = null;
    };
  }, []);

  useEffect(() => {
    state.current = { groups, enabled };
    check.current?.();
  }, [groups, enabled]);
}
