import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import poisJson from '../../data/map/pois.json';
import landmarksJson from '../../data/map/landmarks.json';
import {
  ringToLatLng, shortLabel, categoryStyle,
  SELECTED_STYLE, STRUCTURE_STYLE, BUILDING_STYLE, SIBLING_STYLE,
} from './mapHelpers';
import { setMapInstance } from './mapInstance';
import type { BuildingsMeta, PoiFeature, RoomFeature, Landmark } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;
const POIS = (poisJson as unknown as { features: PoiFeature[] }).features;
const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
// Only cafeterias are drawn as dots. Everything else (bus stops, gates,
// gatehouse, ticket machine, parking, generic letter buildings) stays in
// pois.json for search but is removed from the map to cut clutter.
const DRAWN_POI_TYPES = new Set(['cafeteria']);

function themeColor(varName: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '#cccccc';
}

// Landmarks (dorms / FRRMS / sports centre) draw as dashed secondary outlines
// in both overview and floor-view. They are not drillable — a click opens the
// shared POI detail panel (landmark metadata is poi-shaped).
function drawLandmarks(layer: L.LayerGroup, select: ReturnType<typeof useAppStore.getState>) {
  for (const l of LANDMARKS) {
    const poly = L.polygon(ringToLatLng(l.outline.coordinates[0]), {
      color: themeColor('--color-secondary'), weight: 1.5, dashArray: '4', fillOpacity: 0,
      bubblingMouseEvents: false,
    });
    poly.on('click', () => {
      const c = poly.getBounds().getCenter();
      select.selectMapPoi(
        { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email },
        [c.lng, c.lat],
      );
    }).bindTooltip(l.name).addTo(layer);
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
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, minZoom: 14, maxZoom: 22 })
      .fitBounds(META.campus.bounds as L.LatLngBoundsExpression);
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
      for (const f of POIS.filter((p) => DRAWN_POI_TYPES.has(p.properties.type))) {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], { radius: 6, color: themeColor('--color-secondary'),
          fillColor: themeColor('--color-secondary'), fillOpacity: 0.9, bubblingMouseEvents: false })
          .on('click', () => select.selectMapPoi(f.properties, f.geometry.coordinates))
          .bindTooltip(f.properties.name).addTo(layer);
      }
      drawLandmarks(layer, select);
      // §6: rest at campus bounds, but fly to a chosen place's coord on
      // search/click (a poi/landmark selection) instead of refitting campus.
      if (select.mapSelection?.kind === 'poi') {
        const [lon, lat] = select.mapSelection.coord;
        map.flyTo([lat, lon], 18);
      } else {
        map.flyToBounds(META.campus.bounds as L.LatLngBoundsExpression, { maxZoom: 18, padding: [40, 40] });
      }
      return;
    }

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
    if (!fc) { // geometry still loading — show the building while we wait
      if (b) map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] });
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
    drawLandmarks(layer, select);
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
    if (targetBounds) map.flyToBounds(targetBounds, { maxZoom: 21, padding: [120, 120] });
    else if (b) map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] });
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
