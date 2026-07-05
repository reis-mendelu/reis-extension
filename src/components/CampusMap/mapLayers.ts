import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import landmarksJson from '../../data/map/landmarks.json';
import remotePlacesJson from '../../data/map/remotePlaces.json';
import {
  ringToLatLng, landmarkGroupLabels, remotePlaceRings, remotePlaceCenter,
  BUILDING_STYLE, GARDEN_STYLE, PATH_STYLE, POI_MARKER_STYLE,
} from './mapHelpers';
import type { Landmark, RemotePlace } from '../../types/campusMap';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
export const REMOTE = (remotePlacesJson as { places: RemotePlace[] }).places;
export const REMOTE_IDS = new Set(REMOTE.map((p) => p.id));
// FRRMS + Kolej Akademie are one building under two names → a combined "A / B"
// tooltip. (Adjacent-but-separate places like Tauferovy/sports centre are NOT
// merged — see landmarkGroupLabels.)
const LANDMARK_LABELS = landmarkGroupLabels(LANDMARKS);
// A few landmarks are official lettered campus buildings — FRRMS is "Z" on the
// MENDELU map — and get a permanent centre letter like the drillable buildings
// instead of the hover name. The Místa picker still carries the full pair name.
const LANDMARK_LETTERS: Record<number, string> = { 1587: 'Z' };

// CartoDB Positron: clean grey basemap with no tree dots and minimal labels.
// Free, keyless, retina-aware. maxNativeZoom 20 (one better than OSM's 19)
// reduces upscaling blur at floor-zoom levels. Creates the map, wires the tile
// layer + label-visibility toggle, and returns it (caller owns layers/cleanup).
export function initLeafletMap(container: HTMLElement, campusBounds: L.LatLngBoundsExpression): L.Map {
  const map = L.map(container, {
    zoomControl: true, attributionControl: true, minZoom: 14, maxZoom: 22,
    // Keep Leaflet's default stepped zoom (zoomSnap 1) but make each wheel notch
    // require more scroll (default 60 → 100 px per level) so it doesn't jump so
    // aggressively. zoomSnap:0 (fractional) felt worse — floaty and blurry on
    // intermediate tiles — so we slow the default instead.
    wheelPxPerZoomLevel: 100,
  }).fitBounds(campusBounds);
  // The search box + floor selector own the top-left now, so move the native
  // +/- control to the bottom-right where it no longer sits under them.
  map.zoomControl.setPosition('bottomright');
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 22,
    maxNativeZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  // Show the lettered building names only when zoomed in past the overview.
  // restZoom = the zoom at which the whole campus fits (matches flyToBounds'
  // padding/maxZoom); hide labels at/below it, reveal them one notch in. Computed
  // live with getBoundsZoom so it tracks the real container size, not a constant.
  const cb = L.latLngBounds(campusBounds as L.LatLngBoundsLiteral);
  const syncLabelVisibility = () => {
    const restZoom = Math.min(18, Math.floor(map.getBoundsZoom(cb, false, L.point(40, 40))));
    map.getContainer().classList.toggle('reis-hide-building-labels', map.getZoom() <= restZoom + 1);
  };
  syncLabelVisibility();
  map.on('zoomend', syncLabelVisibility);
  return map;
}

// Vector outlines added to the map right before an animated fly render at the
// OLD zoom and are then CSS-scaled by the zoom animation, so they flash huge and
// in the wrong place until `moveend` re-projects them. Hide the vector + label
// panes for the duration of the fly so only the basemap animates; reveal once
// the camera has settled.
export function flyAndReveal(map: L.Map, fly: () => void): void {
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
export function drawLandmarks(
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

// The off-campus MENDELU sites drawn as their real OSM footprints, in the same
// blue campus-building theme as landmarks. Sites with a grounds boundary (`area`,
// the arboretum garden) DRILL IN like a campus faculty: collapsed they show only
// the garden outline; clicking them reveals the inner map (footpaths + buildings
// + labelled collections). `drilledId` is the currently-selected site's id.
// Sites without an `area` (Lednice/Žabčice/Křtiny) are far off-screen, so they
// always show their footprints. Any part of a site selects the whole site.
export function drawRemotePlaces(
  layer: L.LayerGroup,
  select: ReturnType<typeof useAppStore.getState>,
  drilledId: number | null,
) {
  for (const p of REMOTE) {
    const [clon, clat] = remotePlaceCenter(p);
    const drilled = drilledId === p.id;
    const collapsible = !!p.area;
    // Collapsed garden: a click drills in (fly + reveal). Otherwise a click just
    // selects the site in place (no camera move).
    const select_ = () => select.selectMapPoi(
      { id: p.id, name: p.name, type: p.address ?? '', url: p.url, phone: null, email: null },
      [clon, clat],
    );
    const enter = () => select.focusRemotePlaceById(p.id);

    if (p.area) {
      L.polygon(ringToLatLng(p.area.coordinates[0]), GARDEN_STYLE)
        .on('click', drilled ? select_ : enter)
        .bindTooltip(p.shortName)
        .addTo(layer);
    }
    // Inner detail only when drilled in (or for the always-shown far sites).
    if (drilled || !collapsible) {
      if (p.paths) for (const path of p.paths) {
        L.polyline(ringToLatLng(path), PATH_STYLE).addTo(layer);
      }
      for (const ring of remotePlaceRings(p.outline)) {
        L.polygon(ringToLatLng(ring), BUILDING_STYLE)
          .on('click', select_)
          .bindTooltip(p.shortName)
          .addTo(layer);
      }
      if (p.pois) for (const poi of p.pois) {
        L.circleMarker([poi.lat, poi.lon], POI_MARKER_STYLE)
          .on('click', select_)
          .bindTooltip(poi.name, { permanent: true, direction: 'right', className: 'room-label' })
          .addTo(layer);
      }
    }
  }
}
