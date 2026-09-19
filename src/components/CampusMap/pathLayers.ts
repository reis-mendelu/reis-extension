import L from 'leaflet';
import campusPathsJson from '../../data/map/campusPaths.json';
import { ringToLatLng } from './mapHelpers';
import type { CampusPath } from '../../types/campusMap';

export const CAMPUS_PATHS = (campusPathsJson as { routes: CampusPath[] }).routes;

// The walkways are drawn as a road is drawn: a wide light casing under a narrower
// darker line. One flat stroke over a grey basemap reads as a stray boundary;
// the casing is what makes it read as something you walk on.
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
// A 2.5 px line is not a tap target. An invisible fat polyline on top of it is:
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

export interface DrawnPath {
  casing: L.Polyline;
  line: L.Polyline;
  hit: L.Polyline;
  path: CampusPath;
}

/** "Hlavní brána ↔ C", or just the one end that is named, or null for a path
 *  that begins and ends in open ground — those still highlight when tapped,
 *  they just have nothing truthful to be called. */
export function pathLabel(path: CampusPath): string | null {
  if (path.from && path.to) return `${path.from} ↔ ${path.to}`;
  return path.from ?? path.to ?? null;
}

/**
 * Draws every campus walking route into `layer` and returns them keyed by id so
 * the caller can restyle a selection without a redraw (a redraw moves the
 * camera; picking a path must not).
 */
export function drawCampusPaths(
  layer: L.LayerGroup,
  onSelect: (id: number) => void
): Map<number, DrawnPath> {
  const drawn = new Map<number, DrawnPath>();
  for (const path of CAMPUS_PATHS) {
    const latlngs = ringToLatLng(path.coords);
    const casing = L.polyline(latlngs, CASING_STYLE).addTo(layer);
    const line = L.polyline(latlngs, LINE_STYLE).addTo(layer);
    const hit = L.polyline(latlngs, HIT_STYLE).addTo(layer);
    const label = pathLabel(path);
    if (label) hit.bindTooltip(label, { direction: 'top', className: 'path-label', sticky: true });
    hit.on('click', () => onSelect(path.id));
    drawn.set(path.id, { casing, line, hit, path });
  }
  return drawn;
}

/** Highlights one route end to end and drops the rest back to plain. */
export function highlightPath(drawn: Map<number, DrawnPath>, selectedId: number | null): void {
  for (const [id, d] of drawn) {
    const on = id === selectedId;
    d.casing.setStyle(on ? SELECTED_CASING_STYLE : CASING_STYLE);
    d.line.setStyle(on ? SELECTED_LINE_STYLE : LINE_STYLE);
    if (on) {
      // Above the other paths AND above the building outlines, so a route that
      // runs along a wall is still traceable for its whole length.
      d.casing.bringToFront();
      d.line.bringToFront();
      d.hit.bringToFront();
      const mid = d.path.coords[Math.floor(d.path.coords.length / 2)];
      if (pathLabel(d.path)) d.hit.openTooltip([mid[1], mid[0]]);
    } else d.hit.closeTooltip();
  }
}
