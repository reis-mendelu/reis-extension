import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import buildingsJson from '../../data/map/buildings.json';
import {
  ringToLatLng,
  roomLabel,
  categoryStyle,
  remotePlaceBounds,
  ringContains,
  SELECTED_STYLE,
  STRUCTURE_STYLE,
  BUILDING_STYLE,
  SIBLING_STYLE,
  LIBRARY_FREE_STYLE,
  LIBRARY_BUSY_STYLE,
} from './mapHelpers';
import {
  initLeafletMap,
  flyAndReveal,
  drawLandmarks,
  drawRemotePlaces,
  REMOTE,
  REMOTE_IDS,
} from './mapLayers';
import { setMapInstance } from './mapInstance';
import {
  LIBRARY_PLACE_IDS,
  libraryRoomsByPlaceId,
  libraryHoverLabel,
} from '@/data/map/libraryRooms';
import { isBookableToday } from '@/services/library/nextSlot';
import type { RoomAvailability } from '@/types/library';

// Fill for a library room polygon: free-today → green, known-but-not-free →
// muted, unknown (no availability data, e.g. an upstream failure) → the room's
// neutral base style, so a failed fetch never reads as a false "busy".
function libraryTintStyle(
  placeId: number,
  availability: Record<string, RoomAvailability>,
  now: Date,
  neutral: L.PathOptions
): L.PathOptions {
  const rooms = libraryRoomsByPlaceId(placeId);
  const known = rooms.some((room) => availability[room.staffGuid]);
  if (!known) return neutral;
  const free = rooms.some((room) => {
    const a = availability[room.staffGuid];
    return a ? isBookableToday(a.blocks, room.leadMinutes, now) : false;
  });
  return free ? LIBRARY_FREE_STYLE : LIBRARY_BUSY_STYLE;
}
import type { BuildingsMeta, RoomFeature } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;

// On DESKTOP, at the campus-overview resting zoom the lettered building names
// (X, Q, A…) just clutter the basemap and collide with event pins, so they're
// hidden via the `reis-hide-building-labels` class (src/index.css) and reappear
// the moment the user zooms IN past the overview. On a PHONE they show at rest:
// the map is the whole screen with no side panel naming anything, so the letter
// is the only way to tell one outline from another without tapping it. The
// threshold is computed live in initLeafletMap. The drill interaction is a
// click, not the label.

export function MapCanvas() {
  const isPhone = usePhoneViewport();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());
  const exitHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  // Set only by the floor-view tap-away, so the redraw below can tell "I'm done
  // with this building" (leave the camera where the finger left it) from any
  // other caller of `exitToCampus`, which means "take me back to the whole
  // campus" and should fly there.
  const keepViewRef = useRef(false);
  // Live room polygons keyed by placeId, with their unselected base style — lets
  // a plain map click re-highlight in place without a full redraw or camera move.
  const roomPolysRef = useRef<Map<number, { poly: L.Polygon; base: L.PathOptions }>>(new Map());

  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);
  // The event being composed. Read here rather than moved by a separate hook:
  // this effect is the app's only camera owner, and a second one racing it is
  // exactly how "Ukázat na mapě" ended up drawing the pin while the camera sat
  // on the campus overview.
  const draftCoord = useAppStore((s) => s.draftCoord);
  const focusTarget = useAppStore((s) => s.mapFocusTarget);
  const mapSelection = useAppStore((s) => s.mapSelection);
  const libraryAvailability = useAppStore((s) => s.libraryAvailability);
  // "Latest ref" for the heavy draw effect below: availability data can land
  // seconds after mount (async proxy fetch), and re-running that effect on
  // every such update would re-fly the camera (fitBounds again) even though
  // the user hasn't navigated. The heavy effect reads `libraryAvailability`
  // through this ref (always current, updated every render) instead of
  // depending on it directly, so navigation state (building/floor/focus) is
  // the only thing that triggers a redraw+fly. A separate light effect below
  // reacts to `libraryAvailability` changes to re-tint already-drawn library
  // polygons in place, without touching the camera.
  const libraryAvailabilityRef = useRef(libraryAvailability);
  useEffect(() => {
    libraryAvailabilityRef.current = libraryAvailability;
  }, [libraryAvailability]);

  // Same "latest ref" trick, same reason: moving the draft pin (picking a
  // different room) must not re-fly the camera. Only an explicit request does,
  // and that arrives as a change to draftFocusReq.
  const draftCoordRef = useRef(draftCoord);
  useEffect(() => {
    draftCoordRef.current = draftCoord;
  }, [draftCoord]);

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = initLeafletMap(
      ref.current,
      META.campus.bounds as L.LatLngBoundsExpression,
      isPhone
    );
    layerRef.current.addTo(map);
    mapRef.current = map;
    setMapInstance(map);
    return () => {
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
    };
    // Deliberately once-only. `isPhone` is read at construction to pick the
    // label-visibility threshold; re-running would tear down and rebuild the
    // whole Leaflet map (losing camera and layers) just to change it, and the
    // desktop/phone branches mount different trees anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = layerRef.current;
    layer.clearLayers();
    const select = useAppStore.getState();
    // Leaving floor-view by tapping the basemap keeps the camera; the "Celý
    // kampus" button still re-fits the campus. Cleared where the camera
    // decision is reached rather than here.
    const cameFromMapTap = keepViewRef.current;
    if (exitHandlerRef.current) {
      map.off('click', exitHandlerRef.current);
      exitHandlerRef.current = null;
    }

    if (activeBuildingId === null) {
      for (const b of META.buildings) {
        L.polygon(ringToLatLng(b.outline.coordinates[0]), BUILDING_STYLE)
          .on('click', () => select.setMapBuilding(b.id))
          .bindTooltip(b.name, {
            permanent: true,
            direction: 'center',
            className: 'building-label',
          })
          .addTo(layer);
      }
      drawLandmarks(layer, select, BUILDING_STYLE);
      // A remote site is "drilled in" when it is the selected poi — then its inner
      // map (paths / buildings / collections) is revealed instead of just the
      // collapsed garden outline.
      const drilledRemoteId =
        select.mapSelection?.kind === 'poi' && REMOTE_IDS.has(select.mapSelection.poi.id)
          ? select.mapSelection.poi.id
          : null;
      drawRemotePlaces(layer, select, drilledRemoteId);
      // Clicking the bare basemap (not a building outline or an event pin) clears
      // the current selection — same "click away to dismiss" as floor-view's exit.
      // Building outlines are Leaflet layers (their click doesn't reach the map);
      // event pins are HTML in our pane, so skip clicks that land inside it.
      const onOverviewClick = (e: L.LeafletMouseEvent) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t?.closest('.leaflet-reisEvents-pane')) return;
        const state = useAppStore.getState();
        if (state.placingEvent) {
          // click-to-place: capture [lng,lat]
          state.placeDraftCoord([e.latlng.lng, e.latlng.lat]);
          return;
        }
        const sel = state.mapSelection;
        // Exiting a drilled-in remote site collapses it again (redraw) via
        // focusCampus; a plain selection just clears.
        if (sel?.kind === 'poi' && REMOTE_IDS.has(sel.poi.id)) select.focusCampus();
        else if (sel) select.clearMapSelection();
      };
      map.on('click', onOverviewClick);
      exitHandlerRef.current = onOverviewClick;
      // §6: rest at campus bounds, but fly to a chosen place's coord on
      // search/click instead of refitting campus. A place/landmark (poi) zooms in
      // to 18. An EVENT this effect runs for came from a LIST click (pin clicks
      // don't bump focusReq), so we DO fly there: zoom to 18 when at overview, but
      // never zoom back out if you're already deeper in.
      const sel = select.mapSelection;
      // Choosing a place/landmark/event ports the camera INSTANTLY (like Google
      // Maps), not the slow zoom-out-pan-zoom-in "fly" — animate:false makes
      // setView/fitBounds jump and fire moveend at once (flyAndReveal reveals the
      // vector panes on that moveend).
      if (sel?.kind === 'poi') {
        // A remote site (arboretum/Lednice/…) fits its whole extent so it never
        // over-zooms past its own size; a plain poi (landmark) zooms to 18.
        const rp = REMOTE.find((p) => p.id === sel.poi.id);
        if (rp) {
          flyAndReveal(map, () =>
            map.fitBounds(remotePlaceBounds(rp) as L.LatLngBoundsExpression, {
              maxZoom: 18,
              padding: [50, 50],
              animate: false,
            })
          );
        } else {
          const [lon, lat] = sel.coord;
          flyAndReveal(map, () => map.setView([lat, lon], 18, { animate: false }));
        }
      } else if (sel?.kind === 'event' && sel.event.coord) {
        const [lon, lat] = sel.event.coord;
        flyAndReveal(map, () =>
          map.setView([lat, lon], Math.max(map.getZoom(), 18), { animate: false })
        );
      } else if (cameFromMapTap) {
        // Left floor-view by tapping the basemap: drop the floor plan but leave
        // the camera alone. Re-fitting the campus here threw the user all the
        // way out to the overview when all they did was tap beside a building —
        // the "Celý kampus" button exists for that, and still does it.
        //
        // Deliberately NOT wrapped in flyAndReveal: with no camera move there is
        // no re-projection to hide, and its 900ms safety reveal would blank the
        // vector panes for most of a second on a `moveend` that never comes.
      } else if (focusTarget === 'draft' && draftCoordRef.current) {
        // "Ukázat na mapě": the society is checking where an unpublished event
        // will land. Deliberately NOT a consume-once flag — this effect runs
        // more than once per request, and the version that spent the flag on
        // its first run had the second run re-fit the campus on top of the
        // move. Idempotent is the point: every re-run re-answers "the draft".
        // Never zooms back OUT on someone already looking closer.
        const [lon, lat] = draftCoordRef.current;
        flyAndReveal(map, () =>
          map.setView([lat, lon], Math.max(map.getZoom(), 18), { animate: false })
        );
      } else {
        flyAndReveal(map, () =>
          map.fitBounds(META.campus.bounds as L.LatLngBoundsExpression, {
            maxZoom: 18,
            padding: [40, 40],
            animate: false,
          })
        );
      }
      keepViewRef.current = false;
      return;
    }

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
    if (!fc) {
      // geometry still loading — show the building while we wait
      if (b)
        flyAndReveal(map, () =>
          map.fitBounds(b.bounds as L.LatLngBoundsExpression, {
            maxZoom: 21,
            padding: [50, 50],
            animate: false,
          })
        );
      return;
    }
    // Sibling building outlines stay drawn in floor-view and ARE the
    // navigation: click one to refocus. No BuildingBar needed.
    for (const sib of META.buildings) {
      if (sib.id === activeBuildingId) continue;
      L.polygon(ringToLatLng(sib.outline.coordinates[0]), SIBLING_STYLE)
        .on('click', () => select.setMapBuilding(sib.id))
        .bindTooltip(sib.name, {
          permanent: true,
          direction: 'center',
          className: 'building-label',
        })
        .addTo(layer);
    }
    drawLandmarks(layer, select, SIBLING_STYLE);
    // Tapping the bare basemap leaves floor-view — but only from OUTSIDE the
    // building. The gaps between rooms (corridors, courtyards, stairwells) are
    // still the building, and exiting when a tap lands in one made the floor
    // plan feel like it was slipping out from under you. Tested against the
    // outline, not `bounds`: these footprints are L- and U-shaped.
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (b && ringContains(b.outline.coordinates[0], e.latlng.lng, e.latlng.lat)) return;
      keepViewRef.current = true;
      select.exitToCampus();
    };
    map.on('click', onMapClick);
    exitHandlerRef.current = onMapClick;
    // The selected room (from search/deep-link or a canvas click) gets a bold
    // highlight and the camera flies straight to it — that's the "focus".
    const sel = select.mapSelection;
    const selectedId =
      sel?.kind === 'roomRef' ? sel.entry.placeId : sel?.kind === 'room' ? sel.room.id : null;
    const feats = fc.features
      .filter((f) => f.properties.floorId === activeFloorId)
      .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
    roomPolysRef.current.clear();
    let targetBounds: L.LatLngBounds | null = null;
    for (const f of feats as RoomFeature[]) {
      const p = f.properties,
        struct = p.category === 'structure';
      const isSel = p.id === selectedId;
      const st = categoryStyle(p.category);
      const base: L.PathOptions = struct
        ? STRUCTURE_STYLE
        : {
            color: st.stroke,
            weight: 1,
            fillColor: st.fill,
            fillOpacity: 0.6,
            interactive: true,
            bubblingMouseEvents: false,
          };
      let effectiveBase = base;
      if (LIBRARY_PLACE_IDS.has(p.id)) {
        effectiveBase = libraryTintStyle(p.id, libraryAvailabilityRef.current, new Date(), base);
      }
      const poly = L.polygon(
        ringToLatLng(f.geometry.coordinates[0]),
        isSel ? SELECTED_STYLE : effectiveBase
      );
      if (!struct) {
        poly.on('click', () => select.selectMapRoom(p));
        roomPolysRef.current.set(p.id, { poly, base: effectiveBase });
        if (p.name) {
          // Label sizable rooms permanently (MyMENDELU-style); tiny rooms only on
          // hover, to avoid a wall of overlapping numbers.
          const pb = poly.getBounds();
          const big = pb.getNorthEast().distanceTo(pb.getSouthWest()) > 12;
          const label = LIBRARY_PLACE_IDS.has(p.id)
            ? (libraryHoverLabel(p.id) ?? roomLabel(p.name, p.passportNumber, p.nickname))
            : roomLabel(p.name, p.passportNumber, p.nickname);
          poly.bindTooltip(label, {
            permanent: big,
            direction: 'center',
            className: big ? 'room-label' : '',
          });
        }
      }
      poly.addTo(layer);
      if (isSel) {
        poly.bringToFront();
        targetBounds = poly.getBounds();
      }
    }
    if (targetBounds) {
      const tb = targetBounds;
      flyAndReveal(map, () =>
        map.fitBounds(tb, { maxZoom: 21, padding: [120, 120], animate: false })
      );
    } else if (b) {
      flyAndReveal(map, () =>
        map.fitBounds(b.bounds as L.LatLngBoundsExpression, {
          maxZoom: 21,
          padding: [50, 50],
          animate: false,
        })
      );
    }
    // libraryAvailability intentionally excluded — read via libraryAvailabilityRef
    // so its arrival doesn't trigger a redraw+fly; see comment at the ref
    // declaration and the dedicated re-tint effect below.
  }, [activeBuildingId, activeFloorId, roomsByBuilding, focusReq, focusTarget]);

  // Highlight the selected room in place on a plain map click — restyle the live
  // polygons without a full redraw or camera move (the heavy effect above only
  // re-runs / flies on navigation + search focus, not on selection alone).
  useEffect(() => {
    const selId =
      mapSelection?.kind === 'room'
        ? mapSelection.room.id
        : mapSelection?.kind === 'roomRef'
          ? mapSelection.entry.placeId
          : null;
    for (const [id, { poly, base }] of roomPolysRef.current) {
      if (id === selId) {
        poly.setStyle(SELECTED_STYLE);
        poly.bringToFront();
      } else poly.setStyle(base);
    }
  }, [mapSelection]);

  // Re-tint already-drawn library polygons in place when fresh availability
  // data lands (e.g. a few seconds after mount) — mirrors the selection
  // effect above: restyle the live polygons via roomPolysRef, no redraw and
  // no camera move. The currently-selected room (if any) is left alone; its
  // SELECTED_STYLE is owned by the effect above and re-asserted whenever
  // mapSelection changes.
  useEffect(() => {
    const selId =
      mapSelection?.kind === 'room'
        ? mapSelection.room.id
        : mapSelection?.kind === 'roomRef'
          ? mapSelection.entry.placeId
          : null;
    const now = new Date();
    for (const [placeId, entry] of roomPolysRef.current) {
      if (!LIBRARY_PLACE_IDS.has(placeId)) continue;
      const style = libraryTintStyle(placeId, libraryAvailability, now, entry.base);
      // Always refresh the stored base so a later deselect restores the current
      // tint; only skip the visible restyle while this room is selected.
      roomPolysRef.current.set(placeId, { poly: entry.poly, base: style });
      if (placeId !== selId) entry.poly.setStyle(style);
    }
  }, [libraryAvailability, mapSelection]);

  return <div ref={ref} className="absolute inset-0" />;
}
