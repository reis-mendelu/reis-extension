import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import landmarksJson from '../../data/map/landmarks.json';
import {
  ringToLatLng, shortLabel, categoryStyle, landmarkGroupLabels,
  SELECTED_STYLE, STRUCTURE_STYLE, BUILDING_STYLE, SIBLING_STYLE,
} from './mapHelpers';
import { setMapInstance } from './mapInstance';
import type { BuildingsMeta, RoomFeature, Landmark } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
// FRRMS + Kolej Akademie are one building under two names → a combined "A / B"
// tooltip. (Adjacent-but-separate places like Tauferovy/sports centre are NOT
// merged — see landmarkGroupLabels.)
const LANDMARK_LABELS = landmarkGroupLabels(LANDMARKS);
// A few landmarks are official lettered campus buildings — FRRMS is "Z" on the
// MENDELU map — and get a permanent centre letter like the drillable buildings
// instead of the hover name. The Místa picker still carries the full pair name.
const LANDMARK_LETTERS: Record<number, string> = { 1587: 'Z' };

// At the campus-overview resting zoom the lettered building names (X, Q, A…)
// just clutter the basemap and collide with event pins, so they're hidden via the
// `reis-hide-building-labels` class (src/index.css). They reappear the moment the
// user zooms IN past the overview — the threshold is the zoom at which the whole
// campus fits (computed live with `getBoundsZoom` so it tracks the real container
// size, not a guessed constant). The drill interaction is a click, not the label.

// Vector outlines added to the map right before an animated fly render at the
// OLD zoom and are then CSS-scaled by the zoom animation, so they flash huge and
// in the wrong place until `moveend` re-projects them. Hide the vector + label
// panes for the duration of the fly so only the basemap animates; reveal once
// the camera has settled.
function flyAndReveal(map: L.Map, fly: () => void): void {
  const panes = [map.getPane('overlayPane'), map.getPane('tooltipPane')]
    .filter((p): p is HTMLElement => p != null);
  for (const p of panes) p.style.visibility = 'hidden';
  const reveal = () => { for (const p of panes) p.style.visibility = ''; };
  map.once('moveend', reveal);
  window.setTimeout(reveal, 900); // safety: a fly to ~the current view fires no moveend
  fly();
}

// Landmarks (dorms / FRRMS / sports centre) draw with the same blue campus
// "clickable building" theme as real buildings — solid in overview, fainter
// (sibling style) in floor-view. They are not drillable — a click opens the
// shared POI detail panel (landmark metadata is poi-shaped).
function drawLandmarks(
  layer: L.LayerGroup,
  select: ReturnType<typeof useAppStore.getState>,
  style: L.PathOptions,
) {
  for (const l of LANDMARKS) {
    const poly = L.polygon(ringToLatLng(l.outline.coordinates[0]), style);
    poly.on('click', () => {
      const c = poly.getBounds().getCenter();
      select.selectMapPoi(
        { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email },
        [c.lng, c.lat],
      );
    });
    const letter = LANDMARK_LETTERS[l.id];
    if (letter) poly.bindTooltip(letter, { permanent: true, direction: 'center', className: 'building-label' });
    else poly.bindTooltip(LANDMARK_LABELS.get(l.id) ?? l.name);
    poly.addTo(layer);
  }
}

export function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());
  const exitHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  // Live room polygons keyed by placeId, with their unselected base style — lets
  // a plain map click re-highlight in place without a full redraw or camera move.
  const roomPolysRef = useRef<Map<number, { poly: L.Polygon; base: L.PathOptions }>>(new Map());

  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);
  const mapSelection = useAppStore((s) => s.mapSelection);

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      zoomControl: true, attributionControl: true, minZoom: 14, maxZoom: 22,
      // Keep Leaflet's default stepped zoom (zoomSnap 1) but make each wheel
      // notch require more scroll (default 60 → 100 px per level) so it doesn't
      // jump so aggressively. zoomSnap:0 (fractional) felt worse — floaty and
      // blurry on intermediate tiles — so we slow the default instead.
      wheelPxPerZoomLevel: 100,
    }).fitBounds(META.campus.bounds as L.LatLngBoundsExpression);
    // The search box + floor selector own the top-left now, so move the native
    // +/- control to the bottom-right where it no longer sits under them.
    map.zoomControl.setPosition('bottomright');
    // CartoDB Positron: clean grey basemap with no tree dots and minimal
    // labels. Free, keyless, retina-aware. maxNativeZoom 20 (one better than
    // OSM's 19) reduces upscaling blur at floor-zoom levels.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 22,
      maxNativeZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    layerRef.current.addTo(map);
    // Show the lettered building names only when zoomed in past the overview.
    // restZoom = the zoom at which the whole campus fits (matches flyToBounds'
    // padding/maxZoom); hide labels at/below it, reveal them one notch in.
    const campusBounds = L.latLngBounds(META.campus.bounds as L.LatLngBoundsLiteral);
    const syncLabelVisibility = () => {
      const restZoom = Math.min(18, Math.floor(map.getBoundsZoom(campusBounds, false, L.point(40, 40))));
      // Reveal labels two notches past the overview (one deeper than the first
      // zoom-in) — they should appear only once you're clearly inspecting buildings.
      map.getContainer().classList.toggle('reis-hide-building-labels', map.getZoom() <= restZoom + 1);
    };
    syncLabelVisibility();
    map.on('zoomend', syncLabelVisibility);
    mapRef.current = map;
    setMapInstance(map);
    return () => { setMapInstance(null); map.remove(); mapRef.current = null; };
  }, []);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const layer = layerRef.current; layer.clearLayers();
    const select = useAppStore.getState();
    if (exitHandlerRef.current) { map.off('click', exitHandlerRef.current); exitHandlerRef.current = null; }

    if (activeBuildingId === null) {
      for (const b of META.buildings) {
        L.polygon(ringToLatLng(b.outline.coordinates[0]), BUILDING_STYLE)
          .on('click', () => select.setMapBuilding(b.id))
          .bindTooltip(b.name, { permanent: true, direction: 'center', className: 'building-label' })
          .addTo(layer);
      }
      drawLandmarks(layer, select, BUILDING_STYLE);
      // Clicking the bare basemap (not a building outline or an event pin) clears
      // the current selection — same "click away to dismiss" as floor-view's exit.
      // Building outlines are Leaflet layers (their click doesn't reach the map);
      // event pins are HTML in our pane, so skip clicks that land inside it.
      const onOverviewClick = (e: L.LeafletMouseEvent) => {
        const t = e.originalEvent.target as HTMLElement | null;
        if (t?.closest('.leaflet-reisEvents-pane')) return;
        if (useAppStore.getState().mapSelection) select.clearMapSelection();
      };
      map.on('click', onOverviewClick);
      exitHandlerRef.current = onOverviewClick;
      // §6: rest at campus bounds, but fly to a chosen place's coord on
      // search/click instead of refitting campus. A place/landmark (poi) zooms in
      // to 18; an EVENT does NOT zoom — it only pans at the current zoom so the
      // selected pin re-centres without the jarring zoom-in (events differ from
      // buildings here, by request).
      const sel = select.mapSelection;
      if (sel?.kind === 'poi') {
        const [lon, lat] = sel.coord;
        flyAndReveal(map, () => map.flyTo([lat, lon], 18));
      } else if (sel?.kind === 'event' && sel.event.coord) {
        const [lon, lat] = sel.event.coord;
        flyAndReveal(map, () => map.flyTo([lat, lon], map.getZoom()));
      } else {
        flyAndReveal(map, () => map.flyToBounds(META.campus.bounds as L.LatLngBoundsExpression, { maxZoom: 18, padding: [40, 40] }));
      }
      return;
    }

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
    if (!fc) { // geometry still loading — show the building while we wait
      if (b) flyAndReveal(map, () => map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] }));
      return;
    }
    // Sibling building outlines stay drawn in floor-view and ARE the
    // navigation: click one to refocus. No BuildingBar needed.
    for (const sib of META.buildings) {
      if (sib.id === activeBuildingId) continue;
      L.polygon(ringToLatLng(sib.outline.coordinates[0]), SIBLING_STYLE)
        .on('click', () => select.setMapBuilding(sib.id))
        .bindTooltip(sib.name, { permanent: true, direction: 'center', className: 'building-label' })
        .addTo(layer);
    }
    drawLandmarks(layer, select, SIBLING_STYLE);
    // Clicking the bare basemap (not an outline/room) returns to overview.
    const onMapClick = () => select.exitToCampus();
    map.on('click', onMapClick);
    exitHandlerRef.current = onMapClick;
    // The selected room (from search/deep-link or a canvas click) gets a bold
    // highlight and the camera flies straight to it — that's the "focus".
    const sel = select.mapSelection;
    const selectedId = sel?.kind === 'roomRef' ? sel.entry.placeId
      : sel?.kind === 'room' ? sel.room.id : null;
    const feats = fc.features.filter((f) => f.properties.floorId === activeFloorId)
      .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
    roomPolysRef.current.clear();
    let targetBounds: L.LatLngBounds | null = null;
    for (const f of feats as RoomFeature[]) {
      const p = f.properties, struct = p.category === 'structure';
      const isSel = p.id === selectedId;
      const st = categoryStyle(p.category);
      const base: L.PathOptions = struct ? STRUCTURE_STYLE
        : { color: st.stroke, weight: 1, fillColor: st.fill, fillOpacity: 0.6,
            interactive: true, bubblingMouseEvents: false };
      const poly = L.polygon(ringToLatLng(f.geometry.coordinates[0]), isSel ? SELECTED_STYLE : base);
      if (!struct) {
        poly.on('click', () => select.selectMapRoom(p));
        roomPolysRef.current.set(p.id, { poly, base });
        if (p.name) {
          // Label sizable rooms permanently (MyMENDELU-style); tiny rooms only on
          // hover, to avoid a wall of overlapping numbers.
          const pb = poly.getBounds();
          const big = pb.getNorthEast().distanceTo(pb.getSouthWest()) > 12;
          poly.bindTooltip(shortLabel(p.name),
            { permanent: big, direction: 'center', className: big ? 'room-label' : '' });
        }
      }
      poly.addTo(layer);
      if (isSel) { poly.bringToFront(); targetBounds = poly.getBounds(); }
    }
    if (targetBounds) {
      const tb = targetBounds;
      flyAndReveal(map, () => map.flyToBounds(tb, { maxZoom: 21, padding: [120, 120] }));
    } else if (b) {
      flyAndReveal(map, () => map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] }));
    }
  }, [activeBuildingId, activeFloorId, roomsByBuilding, focusReq]);

  // Highlight the selected room in place on a plain map click — restyle the live
  // polygons without a full redraw or camera move (the heavy effect above only
  // re-runs / flies on navigation + search focus, not on selection alone).
  useEffect(() => {
    const selId = mapSelection?.kind === 'room' ? mapSelection.room.id
      : mapSelection?.kind === 'roomRef' ? mapSelection.entry.placeId : null;
    for (const [id, { poly, base }] of roomPolysRef.current) {
      if (id === selId) { poly.setStyle(SELECTED_STYLE); poly.bringToFront(); }
      else poly.setStyle(base);
    }
  }, [mapSelection]);

  return <div ref={ref} className="absolute inset-0" />;
}
