import type L from 'leaflet';

/**
 * Leaflet's own pane z-indexes, transcribed from `leaflet/dist/leaflet.css`.
 *
 * They live here because every number reIS picks is only meaningful RELATIVE to
 * them: a bare `640` in a component is a number nobody can check, and that is
 * exactly how the event pins ended up underneath the lettered building names.
 * `src/test/guards/mapLayerOrder.test.ts` reads the real stylesheet and fails if
 * a Leaflet upgrade renumbers a pane out from under this table.
 */
export const LEAFLET_PANE_Z = {
  tile: 200,
  overlay: 400,
  shadow: 500,
  marker: 600,
  tooltip: 650,
  popup: 700,
} as const;

/** Leaflet's built-in pane names, for validating a `pane:` option. */
export const LEAFLET_PANE_NAMES = [
  'mapPane',
  'tilePane',
  'overlayPane',
  'shadowPane',
  'markerPane',
  'tooltipPane',
  'popupPane',
] as const;

/**
 * Permanent map annotation: the lettered building names and the room numbers.
 *
 * Carved out of Leaflet's tooltip pane because a permanent label is part of the
 * basemap, not something the student asked to see — so it has to paint UNDER the
 * content on top of the map. Left in the tooltip pane it outranked every event
 * pin, and a letter drew straight through the pin's hover bubble.
 */
export const LABELS_PANE = 'reisLabels';

/** Society event pins and the hover bubble each one carries. */
export const EVENTS_PANE = 'reisEvents';

/**
 * The panes reIS adds, and the one place their z-indexes are decided.
 *
 * labels 620  — above the markers it annotates, below the content over the map.
 * events 640  — above the labels, below the tooltip pane, so a gate name or a
 *               route chip (both user-invoked) still wins over a pin.
 */
export const REIS_PANE_Z = {
  [LABELS_PANE]: 620,
  [EVENTS_PANE]: 640,
} as const satisfies Record<string, number>;

/**
 * Panes whose contents were carved out of `tooltipPane` and must therefore be
 * hidden wherever it is — see `flyAndReveal`. Miss one and its labels flash at
 * the pre-fly position while the basemap animates away underneath them.
 */
export const TOOLTIP_CARVE_OUTS: readonly string[] = [LABELS_PANE];

/** Creates the pane if it is missing, pins its z-index, and returns it. */
export function ensurePane(map: L.Map, name: keyof typeof REIS_PANE_Z): HTMLElement {
  const pane = map.getPane(name) ?? map.createPane(name);
  pane.style.zIndex = String(REIS_PANE_Z[name]);
  // Annotation and pins are things to look at, not to click: the polygons
  // underneath stay reachable. An event pin re-enables pointer events on the
  // button itself (`pointer-events-auto` in EventPin).
  pane.style.pointerEvents = 'none';
  return pane;
}

/** Every reIS pane, created up front so a label can bind into one immediately. */
export function ensureReisPanes(map: L.Map): void {
  for (const name of Object.keys(REIS_PANE_Z) as (keyof typeof REIS_PANE_Z)[])
    ensurePane(map, name);
}
