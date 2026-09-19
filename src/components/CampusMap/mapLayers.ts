import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import landmarksJson from '../../data/map/landmarks.json';
import remotePlacesJson from '../../data/map/remotePlaces.json';
import {
  ringToLatLng,
  landmarkGroupLabels,
  remotePlaceRings,
  remotePlaceCenter,
  BUILDING_STYLE,
  GARDEN_STYLE,
  PATH_STYLE,
  POI_MARKER_STYLE,
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

/**
 * The sites you cross rather than arrive at.
 *
 * The arboretum is one: a walk from Černá Pole to the campus goes straight
 * through it, and nobody needs telling it is a few minutes away. So it answers
 * no taps — they fall through to the map's own tap-away.
 *
 * A list of ids, deliberately, rather than a rule read off the geometry. The
 * first cut used `!!place.area`, which is true of Panská lícha as well — its
 * `area` is the surrounding grounds, but the riding hall inside it is exactly
 * the sort of place a student is told to turn up at, and it quietly stopped
 * being clickable. Which places are scenery is an editorial judgement; it is
 * not derivable from whether OSM happens to draw a boundary.
 */
const WALK_THROUGH_IDS = new Set([-101]); // Botanická zahrada a arboretum
export const walksThrough = (place: Pick<RemotePlace, 'id'>) => WALK_THROUGH_IDS.has(place.id);

// OpenStreetMap's own tiles, desaturated to the grey the overlays were drawn
// against.
//
// This was CartoDB Positron until 2026-08-26, when CARTO began stamping
// "API KEY REQUIRED · carto.com/basemaps/apikey" diagonally across every
// keyless tile — verified by fetching the MENDELU tile directly. Their free
// keyless basemaps are simply over, and a client-side key would ship in the
// bundle for anyone to lift.
//
// OSM is the one remaining source that needs no key and states its terms
// plainly (attribution, modest volume, no bulk downloading — a campus map for
// one faculty's students is squarely inside that). Its standard style is
// colourful, which the overlays were never designed for, so the tile pane is
// desaturated with Tailwind's own `grayscale` utility rather than a stylesheet
// of ours. maxNativeZoom drops 20 → 19, which is OSM's deepest, so floor-level
// zooms upscale one step more than before.
//
// If reIS ever outgrows "modest", the next step is self-hosting or a keyed
// provider behind our Supabase proxy — not a key in the client.
// Creates the map, wires the tile layer + label-visibility toggle, and returns
// it (caller owns layers/cleanup).
export function initLeafletMap(
  container: HTMLElement,
  campusBounds: L.LatLngBoundsExpression,
  /** Reveal the lettered building names at the resting overview zoom rather than
   *  one notch in. On a phone the map is the whole screen and the letters are
   *  the only way to tell one outline from another without tapping — the
   *  desktop's clutter argument does not apply when there is no side panel
   *  naming things. */
  labelsAtRest = false
): L.Map {
  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    minZoom: 14,
    maxZoom: 22,
    // Keep Leaflet's default stepped zoom (zoomSnap 1) but make each wheel notch
    // require more scroll (default 60 → 100 px per level) so it doesn't jump so
    // aggressively. zoomSnap:0 (fractional) felt worse — floaty and blurry on
    // intermediate tiles — so we slow the default instead.
    wheelPxPerZoomLevel: 100,
  }).fitBounds(campusBounds);
  // The search box + floor selector own the top-left now, so move the native
  // +/- control to the bottom-right where it no longer sits under them.
  map.zoomControl.setPosition('bottomright');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 22,
    maxNativeZoom: 19,
    // Utilities, not a stylesheet: Leaflet puts this on the tile pane and the
    // filter applies to every tile image under it. `grayscale` alone reads
    // muddy against the light-on-light overlays, so it is lifted and flattened
    // to land near where Positron sat.
    className: 'grayscale brightness-[1.06] contrast-[0.92]',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  // Show the lettered building names only when zoomed in past the overview.
  // restZoom = the zoom at which the whole campus fits (matches flyToBounds'
  // padding/maxZoom); hide labels at/below it, reveal them one notch in. Computed
  // live with getBoundsZoom so it tracks the real container size, not a constant.
  const cb = L.latLngBounds(campusBounds as L.LatLngBoundsLiteral);
  const syncLabelVisibility = () => {
    const restZoom = Math.min(18, Math.floor(map.getBoundsZoom(cb, false, L.point(40, 40))));
    const hideBelow = labelsAtRest ? restZoom - 1 : restZoom + 1;
    map.getContainer().classList.toggle('reis-hide-building-labels', map.getZoom() <= hideBelow);
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
  const panes = [map.getPane('overlayPane'), map.getPane('tooltipPane')].filter(
    (p): p is HTMLElement => p != null
  );
  for (const p of panes) p.style.visibility = 'hidden';
  const reveal = () => {
    for (const p of panes) p.style.visibility = '';
  };
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
  style: L.PathOptions
) {
  for (const l of LANDMARKS) {
    const poly = L.polygon(ringToLatLng(l.outline.coordinates[0]), style);
    poly.on('click', () => {
      const c = poly.getBounds().getCenter();
      select.selectMapPoi(
        { id: l.id, name: l.name, type: l.type, url: l.url, phone: l.phone, email: l.email },
        [c.lng, c.lat]
      );
    });
    const letter = LANDMARK_LETTERS[l.id];
    if (letter)
      poly.bindTooltip(letter, {
        permanent: true,
        direction: 'center',
        className: 'building-label',
      });
    else poly.bindTooltip(LANDMARK_LABELS.get(l.id) ?? l.name);
    poly.addTo(layer);
  }
}

// The off-campus MENDELU sites drawn as their real OSM footprints, in the same
// blue campus-building theme as landmarks.
//
// Every site draws its whole inner map — footpaths, buildings, labelled
// collections — whatever is selected. It used to take a click to reveal any of
// that for the arboretum, which meant the garden's footpaths, the one genuinely
// useful thing about it, were visible only to someone who already knew to look.
// There is no "drilled in" state left: with every site drawing its whole inner
// map, selecting one changed nothing on screen. On a far site, any part of it
// still selects the whole site.
export function drawRemotePlaces(
  layer: L.LayerGroup,
  select: ReturnType<typeof useAppStore.getState>
) {
  for (const p of REMOTE) {
    const [clon, clat] = remotePlaceCenter(p);
    const select_ = () =>
      select.selectMapPoi(
        { id: p.id, name: p.name, type: p.address ?? '', url: p.url, phone: null, email: null },
        [clon, clat]
      );
    // The garden answers no question, so it takes no taps.
    //
    // It is scenery you walk through, not somewhere you navigate to — and a
    // big green shape that swallowed a tap and flew the camera off to Černá
    // Pole was answering a question nobody had asked, right next to seven
    // buildings where a tap means something. Its taps now fall through to the
    // map, which is the campus's own "tap away to dismiss".
    //
    // HOVER is untouched: the shapes stay interactive, they simply have no
    // click handler, so the names still appear on a point or a tap. Every other
    // site keeps its click — for the far ones (Lednice/Žabčice/Křtiny) an
    // outline on the edge of the map is their only handle.
    //
    // Named, NOT inferred from `area`. Panská lícha has an `area` too — its
    // grounds — but it is somewhere students are sent, and deriving this from
    // geometry silently took the click off its riding hall as well.
    const inert = walksThrough(p);
    const passThrough = (style: L.PathOptions) =>
      inert ? { ...style, bubblingMouseEvents: true } : style;
    const onClick = <T extends L.Layer>(l: T, fn: () => void) => (inert ? l : l.on('click', fn));

    if (p.area) {
      L.polygon(ringToLatLng(p.area.coordinates[0]), passThrough(GARDEN_STYLE))
        .bindTooltip(p.shortName)
        .addTo(layer);
    }
    // Drawn ALWAYS, not only once the garden has been clicked.
    //
    // The arboretum is not a place anyone navigates TO — nobody needs telling
    // it is a two-minute walk. It is a place people walk THROUGH, on the way
    // between the campus and Černá Pole, and the only thing the map owes them
    // is the sight of a path going through it. Behind a click, that path was
    // information only someone who already knew about it would ever find.
    if (p.paths)
      for (const path of p.paths) {
        L.polyline(ringToLatLng(path), PATH_STYLE).addTo(layer);
      }
    for (const ring of remotePlaceRings(p.outline)) {
      onClick(L.polygon(ringToLatLng(ring), passThrough(BUILDING_STYLE)), select_)
        .bindTooltip(p.shortName)
        .addTo(layer);
    }
    if (p.pois)
      for (const poi of p.pois) {
        onClick(L.circleMarker([poi.lat, poi.lon], passThrough(POI_MARKER_STYLE)), select_)
          // Not `permanent`: two names pinned over the greenhouses sat on the
          // map whether or not anyone had asked what those buildings were.
          // Leaflet opens a plain tooltip on hover, and on a touch device on
          // tap, so the name is still reachable on a phone. The default
          // tooltip box is deliberate too — `room-label` is transparent, which
          // reads only because a permanent label sits still.
          .bindTooltip(poi.name, { direction: 'right' })
          .addTo(layer);
      }
  }
}
