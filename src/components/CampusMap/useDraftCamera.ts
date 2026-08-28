import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { subscribeMapInstance } from './mapInstance';

// Zoom a "show me where this lands" jump settles on, unless the society is
// already looking closer — pulling them back out would be a worse view, not a
// better one.
const PREVIEW_ZOOM = 18;

/**
 * Points the map at the event being composed when the composer asks.
 *
 * Two reasons this is its own counter and its own effect rather than a reuse of
 * `mapFocusRequest`:
 *
 * 1. That counter feeds MapCanvas's heavy draw effect, whose camera branch is
 *    driven by `mapSelection`. A draft is not a selectable entity, so it would
 *    fall through to the "fit the whole campus" branch — the opposite of the
 *    close look being asked for.
 * 2. On a phone the map is not mounted when the button is pressed: the same
 *    request is what brings the map tab forward. So the move is held until a
 *    map actually exists, rather than being fired at a null instance and lost.
 *
 * The pending flag is cleared on the first map that honours it, so a later
 * remount (toggling back to the map tab tomorrow) does not re-fly.
 *
 * Must be hosted by something that OUTLIVES the map — the console shell, not
 * the map pane — or the request and the unmount race each other.
 */
export function useDraftCamera(): void {
  const request = useAppStore((s) => s.draftFocusRequest);
  const draftCoord = useAppStore((s) => s.draftCoord);

  // Latest-ref, written in an effect rather than during render: the react-hooks
  // rules ban render-time ref writes, and this only has to be current by the
  // time a request or a map arrives.
  const coordRef = useRef(draftCoord);
  useEffect(() => {
    coordRef.current = draftCoord;
  }, [draftCoord]);

  // Baseline at mount, not at zero: the counter lives in the app-wide store and
  // survives the console being closed and reopened, so "> 0" would fly the
  // camera on mount for anyone who had ever previewed a draft before.
  const seenRef = useRef(request);
  const pendingRef = useRef(false);
  const applyRef = useRef<() => void>(() => {});

  useEffect(() => {
    return subscribeMapInstance((map) => {
      applyRef.current = () => {
        const coord = coordRef.current;
        if (!map || !coord || !pendingRef.current) return;
        pendingRef.current = false;
        // The store holds [lng, lat] like every other event coordinate;
        // Leaflet wants [lat, lng]. This is the one place the pair flips.
        map.setView([coord[1], coord[0]], Math.max(map.getZoom(), PREVIEW_ZOOM), {
          animate: false,
        });
      };
      applyRef.current();
    });
  }, []);

  useEffect(() => {
    if (request <= seenRef.current) return;
    seenRef.current = request;
    pendingRef.current = true;
    applyRef.current();
  }, [request]);
}
