import { useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import type { VenueGroup } from './eventHelpers';
import { subscribeMapInstance } from './mapInstance';
import { EVENTS_PANE, ensurePane } from './mapPanes';

export interface Placed {
  key: string;
  x: number;
  y: number;
  group: VenueGroup;
}

// Leaflet's private projection used by its own markers to animate on zoom.
type ZoomAnimMap = {
  _latLngToNewLayerPoint(
    latlng: L.LatLngExpression,
    zoom: number,
    center: L.LatLngExpression
  ): L.Point;
};

/**
 * Projects the pins (and the composer's draft point) to Leaflet LAYER points and
 * keeps them glued through pan, fly and zoom. Split out of EventLayer, which owns
 * WHICH pins there are; this owns WHERE they are on the map.
 */
export function useEventPinPlacement(groups: VenueGroup[], activeDraft: [number, number] | null) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [draftPt, setDraftPt] = useState<{ x: number; y: number } | null>(null);
  const [pane, setPane] = useState<HTMLElement | null>(null);

  // Re-place pins when the visible groups change (filter toggle, data load).
  const groupsRef = useRef(groups);
  const draftRef = useRef<[number, number] | null>(activeDraft);
  const scheduleRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    groupsRef.current = groups;
    scheduleRef.current?.();
  }, [groups]);
  // Re-project the draft point when it's placed/moved/cleared or the composer
  // opens/closes, so the pin appears (and disappears) immediately.
  useEffect(() => {
    draftRef.current = activeDraft;
    scheduleRef.current?.();
  }, [activeDraft]);

  useEffect(() => {
    let map: L.Map | null = null;
    // Zoom at which `placed` was last computed — lets the `move` handler tell a
    // pure pan (zoom unchanged → pane rides the transform, skip) apart from a
    // fly's continuous zoom change (recompute each frame so pins stay glued).
    let placedZoom = NaN;
    const recompute = () => {
      if (!map) {
        setPlaced([]);
        setDraftPt(null);
        return;
      }
      placedZoom = map.getZoom();
      const next: Placed[] = groupsRef.current.map((g) => {
        const pt = map!.latLngToLayerPoint([g.coord[1], g.coord[0]]);
        return { key: g.key, x: pt.x, y: pt.y, group: g };
      });
      setPlaced(next);
      const d = draftRef.current;
      if (d) {
        const pt = map.latLngToLayerPoint([d[1], d[0]]);
        setDraftPt({ x: pt.x, y: pt.y });
      } else setDraftPt(null);
    };
    scheduleRef.current = recompute;
    // Pure panning needs no handler — the pane is a child of the map pane and
    // rides its transform. A `flyTo` (clicking an event) animates pan AND zoom
    // but does NOT fire `zoomanim`; it fires `move` per frame with a changing
    // zoom, so re-project on `move` whenever the zoom differs from what's drawn —
    // that keeps fly'd pins glued while leaving plain drags on the free path.
    const onMove = () => {
      if (map && map.getZoom() !== placedZoom) recompute();
    };
    // On a stepped zoom, move each pin to its post-zoom layer point so the
    // `leaflet-zoom-animated` transform transitions in sync with the basemap;
    // zoomend/viewreset then settle the exact (rounded) positions.
    const onZoomAnim = (e: L.ZoomAnimEvent) => {
      if (!map) return;
      const proj = map as unknown as ZoomAnimMap;
      setPlaced(
        groupsRef.current.map((g) => {
          const pt = proj
            ._latLngToNewLayerPoint([g.coord[1], g.coord[0]], e.zoom, e.center)
            .round();
          return { key: g.key, x: pt.x, y: pt.y, group: g };
        })
      );
      const d = draftRef.current;
      if (d) {
        const pt = proj._latLngToNewLayerPoint([d[1], d[0]], e.zoom, e.center).round();
        setDraftPt({ x: pt.x, y: pt.y });
      }
    };
    const bind = (m: L.Map) => {
      setPane(ensurePane(m, EVENTS_PANE));
      m.on('zoomanim', onZoomAnim);
      m.on('move', onMove);
      m.on('zoomend viewreset', recompute);
      recompute();
    };
    const unbind = (m: L.Map) => {
      m.off('zoomanim', onZoomAnim);
      m.off('move', onMove);
      m.off('zoomend viewreset', recompute);
    };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map);
      else {
        setPane(null);
        setPlaced([]);
        setDraftPt(null);
      }
    });
    return () => {
      scheduleRef.current = null;
      if (map) unbind(map);
      unsub();
    };
  }, []);

  return { placed, draftPt, pane };
}
