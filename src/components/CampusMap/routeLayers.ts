import L from 'leaflet';
import { translate } from '../../i18n/translate';
import { walkMinutes } from '../../utils/walkTime';
import type { Walk } from '../../utils/routing/shortestWalk';

/**
 * The computed route, drawn.
 *
 * While a route is up it is the loudest thing on the map, because it is the
 * answer to the question that was just asked.
 *
 * FUCHSIA, and the reason is measured rather than aesthetic. This was
 * #2563eb — which is, exactly, `BUILDING_STYLE.color` in mapHelpers. The route
 * was drawn in the same hex as the building outlines it threads between, so on
 * a campus view it read as one more footprint. Every other hue here is already
 * spoken for: the entrance fan
 * is orange, the garden and the brand accent are green, the path network is
 * warm grey. #a21caf is 76 degrees from the nearest of them and is the only
 * candidate tested that also clears 4.5:1 against all three surfaces it
 * crosses — pale basemap 5.30, garden green 4.72, building fill 4.16.
 *
 * Fixed colour literals, like every other style on this map. The basemap is
 * always light whatever the app theme is (see the note above CATEGORY_STYLE in
 * mapLayers), so a theme token here would be the one thing that inverts.
 */
/** The route's colour, in one place. Also in `.route-chip` (src/index.css) and
 *  on the status icon in RouteCard, which must read as the same object. */
export const ROUTE_COLOR = '#a21caf';
const HALO: L.PathOptions = {
  color: '#ffffff',
  weight: 9,
  opacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
const LINE: L.PathOptions = {
  color: ROUTE_COLOR,
  weight: 5,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
/**
 * Redraw the route from scratch.
 *
 * Clear-and-rebuild rather than mutate: a route is recomputed once per tap, not
 * per frame, so there is nothing to save by diffing — and a layer that
 * accumulates stale polylines is the bug this shape makes impossible.
 */
/**
 * Where the student is standing.
 *
 * Drawn from the position alone, NOT as part of a route — that was the bug.
 * The start dot only existed inside `drawRoute`, so every answer that is not a
 * walk (the garden shut, too far, nowhere to go) left the map with no "you are
 * here" at all: the app talked about a place it never pointed at.
 *
 * Three rings, which is what every map app converged on because it survives any
 * terrain: a soft tinted halo that separates the dot from whatever is under it,
 * a white collar, and a saturated core. The first version was a slate dot with
 * a grey halo and read, correctly, as ugly — a dark blob on pale paper with
 * nothing to say it belonged to this app.
 *
 * In the ROUTE's colour, not a neutral. When there is a walk this dot is its
 * start, and when there is not it is still the thing the card is talking about;
 * either way it belongs to the same answer, and the map already spends blue on
 * buildings, orange on the entrance fan and green on the garden.
 */
const POSITION_GLOW: L.CircleMarkerOptions = {
  radius: 14,
  stroke: false,
  fillColor: ROUTE_COLOR,
  fillOpacity: 0.13,
  interactive: false,
};
const POSITION_COLLAR: L.CircleMarkerOptions = {
  radius: 8.5,
  stroke: false,
  fillColor: '#ffffff',
  fillOpacity: 1,
  interactive: false,
};
const POSITION_CORE: L.CircleMarkerOptions = {
  radius: 6,
  stroke: false,
  fillColor: ROUTE_COLOR,
  fillOpacity: 1,
  interactive: false,
};

export function drawPosition(layer: L.LayerGroup, at: [number, number] | null): void {
  layer.clearLayers();
  if (!at) return;
  const ll = L.latLng(at[1], at[0]);
  L.circleMarker(ll, POSITION_GLOW).addTo(layer);
  L.circleMarker(ll, POSITION_COLLAR).addTo(layer);
  L.circleMarker(ll, POSITION_CORE).addTo(layer);
}

export function drawRoute(layer: L.LayerGroup, walk: Walk | null, language: string): void {
  layer.clearLayers();
  // A one-point walk is "you are already there", which the card says in words.
  // A single dot on the map would say nothing.
  if (!walk || walk.coords.length < 2) return;

  const latlngs = walk.coords.map(([lon, lat]) => L.latLng(lat ?? 0, lon ?? 0));
  const end = latlngs.at(-1);
  if (!end) return;
  L.polyline(latlngs, HALO).addTo(layer);
  L.polyline(latlngs, LINE).addTo(layer);

  // The chip sits at the DESTINATION, matching the entrance fan's convention:
  // the number answers "how long until I am there", so it belongs where there
  // is.
  //
  // An L.tooltip, exactly as pathLayers builds its own — NOT an L.divIcon. A
  // divIcon renders `leaflet-marker-icon <className>`, so it never matches the
  // `.leaflet-tooltip.route-chip` rule that styles this: the first version
  // shipped a 12x12 transparent box with theme-coloured text on an
  // always-light basemap, i.e. nothing a student could read.
  L.tooltip({
    permanent: true,
    direction: 'top',
    className: 'route-chip',
    offset: [0, -8],
    // Above the event pins: this is the answer to "how do I get there".
    pane: 'tooltipPane',
  })
    .setLatLng(end)
    .setContent(translate(language, 'map.walkMinutes', { n: walkMinutes(walk.lengthM) }))
    .addTo(layer);
}
