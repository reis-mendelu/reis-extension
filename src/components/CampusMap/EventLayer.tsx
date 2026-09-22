import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type L from 'leaflet';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { groupEventsByVenue, type VenueGroup } from './eventHelpers';
import { subscribeMapInstance } from './mapInstance';
import { EVENTS_PANE, ensurePane } from './mapPanes';
import { EventPin } from './EventPin';
import { DraftPin } from './DraftPin';
import { societyById } from '../../data/societies';
import { isScheduledEvent } from './eventWindow';
import { trackMapEventView } from '../../api/featureUsage';

interface Placed {
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

// The pins live in their own Leaflet pane — a child of the map pane, so Leaflet
// translates it for free while panning and pins stay glued with no JS. Which
// pane, and where it sits in the paint order, is decided in mapPanes.ts: this
// used to be a bare `640` here, which put every pin (and its hover bubble)
// underneath Leaflet's tooltip pane, i.e. underneath the lettered building names.

// HTML pins (not Leaflet markers) so the balloons can use Tailwind/DaisyUI and
// hover bubbles, but rendered INTO a Leaflet pane via a portal. Positions are
// LAYER points (relative to the map pane), so panning moves them for free. On a
// zoom they ride the animation exactly like native markers: `zoomanim` moves
// each pin to its post-zoom layer point and the `leaflet-zoom-animated` class
// transitions the transform in sync with the basemap. zoomend/viewreset settle
// the exact positions. Pins only show in campus overview, not floor-view.
export function EventLayer() {
  // One layer, two hosts: the student map draws the public feed, the admin
  // console's map draws the active society's own events (including the ones
  // still scheduled and hidden from students).
  const authoring = useAppStore((s) => s.adminConsoleOpen);
  // The student's own view of the public feed: a society can mark an event for
  // its followers only, and this is where that is honoured.
  const publicEvents = useVisibleMapEvents();
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  // NOT filtered while authoring. A society composing an event has to see the
  // one it just marked for its followers — hiding it from its own author would
  // read as the publish having failed.
  const events = authoring ? societyEvents : publicEvents;
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  // The in-progress event location: only meaningful while the composer is open.
  const composerOpen = useAppStore((s) => s.composerOpen);
  const draftCoord = useAppStore((s) => s.draftCoord);
  const assocId = useAppStore((s) => s.adminActiveAssociationId);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const { language, t } = useTranslation();
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [draftPt, setDraftPt] = useState<{ x: number; y: number } | null>(null);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const activeDraft = composerOpen ? draftCoord : null;
  // A pin opened on the student map is the map-view signal. NOT while
  // authoring: the admin console renders this same layer over a society's own
  // events, and a society checking its own listing is not a student looking at
  // it. Tracked here rather than inside `focusEventById`, because that action
  // is also how a Novinky feed click and the admin console's own list open an
  // event — both of which would arrive as map views.
  const selectEvent = (id: string) => {
    if (!authoring) void trackMapEventView(id);
    focusEvent(id);
  };
  const draftColor = (assocId ? societyById(assocId)?.color : null) ?? '#0046a0';
  // Events are loaded by the store (initializeStore + language handlers), not a
  // fetch-in-useEffect here — this layer stays presentational over store state.

  const groups = useMemo(() => {
    // Every event the caller's source gave us. The society filter that used to
    // narrow this is gone with its chips, which also ends the class of bug it
    // kept producing: a stored choice applied to a surface with no control to
    // clear it, so the pins and the list beside them disagreed.
    return groupEventsByVenue(events);
  }, [events]);

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

  // The draft pin can be the only thing to show (placing a first event with no
  // saved events yet), so don't bail on an empty `placed` when a draft exists.
  if (activeBuildingId !== null || !pane || (placed.length === 0 && !draftPt)) return null;
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
          scheduled={authoring && p.group.events.some((e) => isScheduledEvent(e.date))}
          locale={language === 'en' ? 'en-US' : 'cs-CZ'}
          onSelect={selectEvent}
        />
      ))}
      {draftPt && (
        <DraftPin
          x={draftPt.x}
          y={draftPt.y}
          color={draftColor}
          label={t('map.draftPinLabel')}
          onClick={beginPlacing}
        />
      )}
    </>,
    pane
  );
}
