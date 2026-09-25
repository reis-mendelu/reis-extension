import L from 'leaflet';
import campusPathsJson from '../../data/map/campusPaths.json';
import { ringToLatLng } from './mapHelpers';
import type { CampusEntrance, CampusPath } from '../../types/campusMap';

const DATA = campusPathsJson as {
  entrances: CampusEntrance[];
  network: number[][][];
  routes: CampusPath[];
};
/** Every stretch of campus path exactly once — the thing that gets drawn. */
export const CAMPUS_NETWORK: number[][][] = DATA.network;

// `entrances` and `routes` are still in the file and still load-bearing, but
// nothing here reads them any more. The gates were once the map's only markers
// and the first half of a two-tap question — pick the gate you came in by, then
// your building, and one precomputed walk lit up. The router answers that from
// where the student is actually standing, so the dots and the question are
// gone. The data stays because it is what the routing graph joins the outside
// world on, and `routes` is the independent build-time computation that
// `againstCommittedRoutes` checks the live router against.

// The network is drawn as a DOTTED trail on a white halo, not as a casing under
// a solid line. A casing under a solid stroke is how a road is drawn, and drawn
// that way the campus paths read as more streets and sink into the basemap.
//
// The colour is deliberately NOT the MENDELU green. Green in the always-on
// layer collides with the arboretum polygon, with the primary-green UI around
// the map, and worst of all with the highlighted walks, which are the thing
// that has to jump out. Colour is spent on what you asked for; the network it
// sits on stays quiet.
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

/**
 * Draws the campus walking network.
 *
 * The base comes from `network`, not from the walks. The walks overlap heavily
 * — 42 of them radiate from 6 gates — and drawing each one's halo and line in
 * turn paints every shared stretch several times, so one walk's white halo
 * scribbles over the next walk's line. The deduplicated network gives one clean
 * set of lines with every halo under every line.
 */
export function drawCampusPaths(layer: L.LayerGroup): void {
  // Two passes, not one per stroke: every halo has to be under every line, or a
  // stroke's own halo cuts a white notch across the one crossing it.
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), HALO_STYLE).addTo(layer);
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), TRAIL_STYLE).addTo(layer);
}
