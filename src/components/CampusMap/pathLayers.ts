import L from 'leaflet';
import campusPathsJson from '../../data/map/campusPaths.json';
import { ringToLatLng } from './mapHelpers';
import type { CampusPath } from '../../types/campusMap';

const DATA = campusPathsJson as {
  network: [number, number][][];
  routes: CampusPath[];
};
/** Every stretch of campus path exactly once — the thing that gets drawn. */
export const CAMPUS_NETWORK = DATA.network;
/** The place-to-place walks over it — the thing that gets tapped. */
export const CAMPUS_PATHS = DATA.routes;

// The walkways are drawn the way a road is drawn: a wide light casing under a
// narrower darker line. One flat stroke over a grey basemap reads as a stray
// boundary; the casing is what makes it read as something you walk on.
//
// Fixed literals, like every other style on this map — the basemap is always
// light whatever the app theme is (see the note above CATEGORY_STYLE).
const CASING_STYLE: L.PathOptions = {
  color: '#ffffff',
  weight: 6,
  opacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
const LINE_STYLE: L.PathOptions = {
  color: '#94a3b8',
  weight: 2.5,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
// Orange, the same "this is the one you picked" colour the selected room uses.
const SELECTED_LINE_STYLE: L.PathOptions = { ...LINE_STYLE, color: '#ea580c', weight: 4 };
const SELECTED_CASING_STYLE: L.PathOptions = { ...CASING_STYLE, weight: 9 };
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

/** "Hlavní brána ↔ C" — the two places this route runs between. */
export function pathLabel(path: CampusPath): string {
  return `${path.from} ↔ ${path.to}`;
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
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), CASING_STYLE).addTo(layer);
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), LINE_STYLE).addTo(layer);

  const highlight = {
    casing: L.polyline([], SELECTED_CASING_STYLE).addTo(layer),
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
export function highlightPath(layers: CampusPathLayers, selectedId: number | null): void {
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
    .bindTooltip(pathLabel(path), { permanent: true, direction: 'top', className: 'path-label' })
    .openTooltip([mid[1], mid[0]]);
}
