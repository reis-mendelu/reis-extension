import L from 'leaflet';
import campusPathsJson from '../../data/map/campusPaths.json';
import { ringToLatLng } from './mapHelpers';
import { translate } from '../../i18n/translate';
import { walkMinutes } from '../../utils/walkTime';
import { tooltipShift } from '../../utils/tooltipShift';
import type { CampusEntrance, CampusPath } from '../../types/campusMap';

const DATA = campusPathsJson as {
  entrances: CampusEntrance[];
  network: [number, number][][];
  routes: CampusPath[];
};
/** Every stretch of campus path exactly once — the thing that gets drawn. */
export const CAMPUS_NETWORK = DATA.network;
/** Every walk from an entrance to a building. */
export const CAMPUS_WALKS = DATA.routes;
/** The ways onto the campus — the only points the map marks. */
export const CAMPUS_ENTRANCES = DATA.entrances;

/** Walks grouped by the entrance they start at. */
export const WALKS_BY_ENTRANCE = CAMPUS_WALKS.reduce((acc, w) => {
  (acc.get(w.from) ?? acc.set(w.from, []).get(w.from)!).push(w);
  return acc;
}, new Map<string, CampusPath[]>());

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
const FAN_HALO_STYLE: L.PathOptions = { ...HALO_STYLE, weight: 8.5, opacity: 1 };
const FAN_LINE_STYLE: L.PathOptions = {
  ...TRAIL_STYLE,
  color: '#ea580c',
  weight: 4.2,
  dashArray: '0.1 7',
};

export interface CampusWalkLayers {
  /** ONE polyline each, holding every walk of the chosen entrance at once. */
  fanHalo: L.Polyline;
  fanLine: L.Polyline;
  /** The "4 min" labels at the building end of each walk. */
  chips: L.LayerGroup;
}

/** "4 min" — how long this walk takes. */
export function walkLabel(path: CampusPath, language: string): string {
  return translate(language, 'map.walkMinutes', { n: walkMinutes(path.lengthM) });
}

/**
 * Draws the campus walking network, plus the empty layers a chosen entrance
 * fills in.
 *
 * The base comes from `network`, not from the walks. The walks overlap heavily
 * — 42 of them radiate from 6 gates — and drawing each one's halo and line in
 * turn paints every shared stretch several times, so one walk's white halo
 * scribbles over the next walk's line. The deduplicated network gives one clean
 * set of lines with every halo under every line.
 */
export function drawCampusPaths(layer: L.LayerGroup): CampusWalkLayers {
  // Two passes, not one per stroke: every halo has to be under every line, or a
  // stroke's own halo cuts a white notch across the one crossing it.
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), HALO_STYLE).addTo(layer);
  for (const stroke of CAMPUS_NETWORK) L.polyline(ringToLatLng(stroke), TRAIL_STYLE).addTo(layer);

  // A Leaflet polyline takes an array of lines, so the whole fan is two layers
  // however many walks it holds — and same-colour overlap is invisible, which
  // is what makes the fan readable where its walks share a stretch.
  return {
    fanHalo: L.polyline([], FAN_HALO_STYLE).addTo(layer),
    fanLine: L.polyline([], FAN_LINE_STYLE).addTo(layer),
    chips: L.layerGroup().addTo(layer),
  };
}

/** The one walk from this gate to this building, or undefined if there is none. */
export function findWalk(entrance: string | null, building: string | null) {
  if (!entrance || !building) return undefined;
  return WALKS_BY_ENTRANCE.get(entrance)?.find((w) => w.to === building);
}

/**
 * Draws ONE walk — the gate the student came in by, to the building they picked
 * — with the time it takes at the far end.
 *
 * Deliberately one, not all seven. Lighting every walk from a gate at once
 * answered both halves of the question simultaneously and put seven times on
 * the map, so the student had to read the whole campus to find their own. Two
 * taps, one answer.
 */
export function showWalk(
  layers: CampusWalkLayers,
  walk: CampusPath | undefined,
  language: string,
  map?: L.Map
): void {
  const { fanHalo, fanLine, chips } = layers;
  chips.clearLayers();
  if (!walk) {
    fanHalo.setLatLngs([]);
    fanLine.setLatLngs([]);
    return;
  }
  const line = ringToLatLng(walk.coords);
  fanHalo.setLatLngs(line);
  fanLine.setLatLngs(line);
  fanHalo.bringToFront();
  fanLine.bringToFront();

  const end = walk.coords.at(-1)!;
  // Above the building, not on it: the chip sat over the letter the building
  // draws in its own centre, hiding the name of the place it is telling you
  // about.
  L.tooltip({ permanent: true, direction: 'top', className: 'walk-chip', offset: [0, -30] })
    .setLatLng([end[1], end[0]])
    .setContent(walkLabel(walk, language))
    .addTo(chips);
  if (map) keepChipsOnScreen(chips, map);
}

/**
 * Nudges any chip that landed off the edge back onto the map.
 *
 * Leaflet anchors a tooltip on its point and does not care whether the result
 * is still inside the container, and a building at the edge of the frame puts
 * its time label over the side. Measured here, decided by `tooltipShift`.
 */
function keepChipsOnScreen(chips: L.LayerGroup, map: L.Map): void {
  const width = map.getContainer().clientWidth;
  for (const t of chips.getLayers()) {
    const el = (t as L.Tooltip).getElement();
    if (!el) continue;
    el.style.marginLeft = '0px';
    const box = el.getBoundingClientRect();
    const mapBox = map.getContainer().getBoundingClientRect();
    const shift = tooltipShift(box.left - mapBox.left, box.width, width);
    if (shift) el.style.marginLeft = `${shift}px`;
  }
}
