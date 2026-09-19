import L from 'leaflet';
import campusPathsJson from '../../data/map/campusPaths.json';
import { ringToLatLng } from './mapHelpers';
import { translate } from '../../i18n/translate';
import { walkMinutes } from '../../utils/walkTime';
import type { CampusPath, CampusPlace } from '../../types/campusMap';

const DATA = campusPathsJson as {
  destinations: CampusPlace[];
  network: [number, number][][];
  routes: CampusPath[];
};
/** Every stretch of campus path exactly once — the thing that gets drawn. */
export const CAMPUS_NETWORK = DATA.network;
/** The place-to-place walks over it — the thing that gets tapped. */
export const CAMPUS_PATHS = DATA.routes;
/** Where each of those walks begins and ends. */
export const CAMPUS_DESTINATIONS = DATA.destinations;

// The network is drawn as a DOTTED trail on a white halo, not as a casing under
// a solid line.
//
// A casing under a solid stroke is how a road is drawn, and drawn that way the
// campus paths read as more streets and sink into the basemap, which is exactly
// what they did. Round dots on a halo read as a thing you walk, which is the
// convention every foot-navigation map uses.
//
// The colour is deliberately NOT the MENDELU green, and that was a reversal.
// Green in the always-on layer looked better for about a day: it collides with
// the arboretum polygon, with the primary-green UI around the map, and — worst —
// with the SELECTED route, which is the one thing that has to jump out. Colour
// is spent on the route you tapped; the network it sits on stays quiet. That
// also matches how the layer earns its keep over time: the network stops telling
// you anything once you know the campus, while the route you just asked for
// never does.
//
// Fixed literals, like every other style on this map — the basemap is always
// light whatever the app theme is (see the note above CATEGORY_STYLE).
const HALO_STYLE: L.PathOptions = {
  color: '#ffffff',
  weight: 6,
  opacity: 0.9,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
// `0.1 6` rather than `0 6`: a zero-length dash with a round cap is a dot in
// every engine that matters, but 0 is the value renderers disagree about.
const TRAIL_STYLE: L.PathOptions = {
  color: '#a8a29e',
  weight: 3,
  opacity: 1,
  dashArray: '0.1 6',
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
// Orange, the same "this is the one you picked" colour the selected room uses —
// and the only saturated thing on the layer, so it is findable at a glance.
const SELECTED_LINE_STYLE: L.PathOptions = {
  ...TRAIL_STYLE,
  color: '#ea580c',
  weight: 4.2,
  dashArray: '0.1 7',
};
const SELECTED_HALO_STYLE: L.PathOptions = { ...HALO_STYLE, weight: 8.5, opacity: 1 };
// A 2.5 px line is not a tap target. An invisible fat polyline over it is:
// ~44 px of slop at the finger, which is the whole reason a path can be tapped
// at all. `bubblingMouseEvents: false` is load-bearing — without it the same tap
// also reaches MapCanvas's overview handler, which clears the selection the tap
// just made.
const HIT_STYLE: L.PathOptions = {
  color: '#000000',
  weight: 22,
  opacity: 0,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: true,
  bubblingMouseEvents: false,
};

export interface CampusPathLayers {
  /** Per route, the invisible line that answers a tap. */
  hits: Map<number, L.Polyline>;
  routes: Map<number, CampusPath>;
  /** ONE reusable pair of polylines that becomes whichever route is chosen. */
  highlight: { casing: L.Polyline; line: L.Polyline };
}

/**
 * "5 min · Hlavní brána ↔ C" — how long the walk takes, then where it runs.
 *
 * Time first on purpose. The chip is capped and truncates with an ellipsis, so
 * whatever leads survives a long pair of names — and the minutes are the part a
 * student is actually deciding on.
 */
export function pathLabel(path: CampusPath, language: string): string {
  const mins = translate(language, 'map.walkMinutes', { n: walkMinutes(path.lengthM) });
  return `${mins} · ${path.from} ↔ ${path.to}`;
}

/**
 * Draws the campus walking network and lays the tap targets over it.
 *
 * The base layer comes from `network`, not from the routes. The routes overlap
 * by design — that is what makes them connected — and drawing 46 overlapping
 * casing+line pairs paints every shared stretch several times, so one route's
 * white casing scribbles over the next route's line. Drawing the deduplicated
 * network gives one clean set of lines, with every casing under every line.
 */
export function drawCampusPaths(
  layer: L.LayerGroup,
  onSelect: (id: number) => void
): CampusPathLayers {
  // Two passes, not one per stroke: every casing has to be under every line, or
  // a stroke's own casing cuts a white notch across the one crossing it.
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), HALO_STYLE).addTo(layer);
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), TRAIL_STYLE).addTo(layer);

  const highlight = {
    casing: L.polyline([], SELECTED_HALO_STYLE).addTo(layer),
    line: L.polyline([], SELECTED_LINE_STYLE).addTo(layer),
  };

  const hits = new Map<number, L.Polyline>();
  const routes = new Map<number, CampusPath>();
  for (const path of CAMPUS_PATHS) {
    const hit = L.polyline(ringToLatLng(path.coords), HIT_STYLE).addTo(layer);
    hit.on('click', () => onSelect(path.id));
    hits.set(path.id, hit);
    routes.set(path.id, path);
  }
  return { hits, routes, highlight };
}

/** Lays one route over the network, end to end, and names where it runs. */
export function highlightPath(
  layers: CampusPathLayers,
  selectedId: number | null,
  language = 'cz'
): void {
  const { highlight } = layers;
  const path = selectedId === null ? undefined : layers.routes.get(selectedId);
  if (!path) {
    highlight.casing.setLatLngs([]);
    highlight.line.setLatLngs([]);
    highlight.line.unbindTooltip();
    return;
  }
  const latlngs = ringToLatLng(path.coords);
  highlight.casing.setLatLngs(latlngs);
  highlight.line.setLatLngs(latlngs);
  // Above the network AND above the building outlines, so a route that runs
  // along a wall stays traceable for its whole length.
  highlight.casing.bringToFront();
  highlight.line.bringToFront();
  // One tooltip on one layer: there is no second object that could keep a stale
  // label open, which is how the first version ended up showing "B ↔ C" beside
  // the newly chosen "Zemědělská ↔ B".
  const mid = path.coords[Math.floor(path.coords.length / 2)];
  highlight.line
    .bindTooltip(pathLabel(path, language), {
      permanent: true,
      direction: 'top',
      className: 'path-label',
    })
    .openTooltip([mid[1], mid[0]]);
}
