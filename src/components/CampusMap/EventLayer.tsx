import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { filterEvents, groupEventsByVenue, type VenueGroup } from './eventHelpers';
import { subscribeMapInstance } from './mapInstance';
import { EventPin } from './EventPin';

interface Placed { key: string; x: number; y: number; group: VenueGroup; }

// Leaflet's private projection used by its own markers to animate on zoom.
type ZoomAnimMap = {
  _latLngToNewLayerPoint(latlng: L.LatLngExpression, zoom: number, center: L.LatLngExpression): L.Point;
};

// Dedicated Leaflet pane for our pins. A child of the map pane (z below tooltips),
// so Leaflet translates it for free while panning — pins stay glued with no JS.
const PANE_NAME = 'reisEvents';

// HTML pins (not Leaflet markers) so the balloons can use Tailwind/DaisyUI and
// hover bubbles, but rendered INTO a Leaflet pane via a portal. Positions are
// LAYER points (relative to the map pane), so panning moves them for free. On a
// zoom they ride the animation exactly like native markers: `zoomanim` moves
// each pin to its post-zoom layer point and the `leaflet-zoom-animated` class
// transitions the transform in sync with the basemap. zoomend/viewreset settle
// the exact positions. Pins only show in campus overview, not floor-view.
export function EventLayer() {
  const mode = useAppStore((s) => s.mapMode);
  const publicEvents = useAppStore((s) => s.mapEvents);
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  const events = mode === 'society' ? societyEvents : publicEvents;
  const eventFilter = useAppStore((s) => s.eventFilter);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const { language } = useTranslation();
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  // Events are loaded by the store (initializeStore + language handlers), not a
  // fetch-in-useEffect here — this layer stays presentational over store state.

  const groups = useMemo(() => {
    const visible = filterEvents(events, eventFilter);
    return groupEventsByVenue(visible);
  }, [events, eventFilter]);

  // Re-place pins when the visible groups change (filter toggle, data load).
  const groupsRef = useRef(groups);
  const scheduleRef = useRef<(() => void) | null>(null);
  useEffect(() => { groupsRef.current = groups; scheduleRef.current?.(); }, [groups]);

  useEffect(() => {
    let map: L.Map | null = null;
    // Zoom at which `placed` was last computed — lets the `move` handler tell a
    // pure pan (zoom unchanged → pane rides the transform, skip) apart from a
    // fly's continuous zoom change (recompute each frame so pins stay glued).
    let placedZoom = NaN;
    const recompute = () => {
      if (!map) { setPlaced([]); return; }
      placedZoom = map.getZoom();
      const next: Placed[] = groupsRef.current.map((g) => {
        const pt = map!.latLngToLayerPoint([g.coord[1], g.coord[0]]);
        return { key: g.key, x: pt.x, y: pt.y, group: g };
      });
      setPlaced(next);
    };
    scheduleRef.current = recompute;
    // Pure panning needs no handler — the pane is a child of the map pane and
    // rides its transform. A `flyTo` (clicking an event) animates pan AND zoom
    // but does NOT fire `zoomanim`; it fires `move` per frame with a changing
    // zoom, so re-project on `move` whenever the zoom differs from what's drawn —
    // that keeps fly'd pins glued while leaving plain drags on the free path.
    const onMove = () => { if (map && map.getZoom() !== placedZoom) recompute(); };
    // On a stepped zoom, move each pin to its post-zoom layer point so the
    // `leaflet-zoom-animated` transform transitions in sync with the basemap;
    // zoomend/viewreset then settle the exact (rounded) positions.
    const onZoomAnim = (e: L.ZoomAnimEvent) => {
      if (!map) return;
      const proj = map as unknown as ZoomAnimMap;
      setPlaced(groupsRef.current.map((g) => {
        const pt = proj._latLngToNewLayerPoint([g.coord[1], g.coord[0]], e.zoom, e.center).round();
        return { key: g.key, x: pt.x, y: pt.y, group: g };
      }));
    };
    const bind = (m: L.Map) => {
      const p = m.getPane(PANE_NAME) ?? m.createPane(PANE_NAME);
      p.style.zIndex = '640';
      p.style.pointerEvents = 'none';
      setPane(p);
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
      if (map) bind(map); else { setPane(null); setPlaced([]); }
    });
    return () => {
      scheduleRef.current = null;
      if (map) unbind(map);
      unsub();
    };
  }, []);

  if (activeBuildingId !== null || !pane || placed.length === 0) return null;
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  return createPortal(
    <>
      {placed.map((p) => (
        <EventPin
          key={p.key}
          group={p.group}
          x={p.x}
          y={p.y}
          selected={p.group.events.some((e) => e.id === selectedId)}
          locale={language === 'en' ? 'en-US' : 'cs-CZ'}
          onSelect={focusEvent}
        />
      ))}
    </>,
    pane,
  );
}
