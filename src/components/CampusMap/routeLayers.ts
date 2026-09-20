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
 * here" at all: the student was told something about a place the map never
 * pointed at. Measured on a real phone standing at FRRMS on a Sunday.
 *
 * Slate, not the route's fuchsia and not blue. Blue is `BUILDING_STYLE.color`,
 * and the route colour would claim this dot is part of a walk that may not
 * exist. A dark neutral in a white ring is the one thing on this basemap that
 * cannot be mistaken for terrain.
 */
const POSITION_HALO: L.CircleMarkerOptions = {
  radius: 11,
  stroke: false,
  fillColor: '#1c1917',
  fillOpacity: 0.14,
  interactive: false,
};
const POSITION_DOT: L.CircleMarkerOptions = {
  radius: 6.5,
  color: '#ffffff',
  weight: 3,
  fillColor: '#1c1917',
  fillOpacity: 1,
  interactive: false,
};

export function drawPosition(layer: L.LayerGroup, at: [number, number] | null): void {
  layer.clearLayers();
  if (!at) return;
  const ll = L.latLng(at[1], at[0]);
  L.circleMarker(ll, POSITION_HALO).addTo(layer);
  L.circleMarker(ll, POSITION_DOT).addTo(layer);
}

export function drawRoute(layer: L.LayerGroup, walk: Walk | null, language: string): void {
  layer.clearLayers();
  // A one-point walk is "you are already there", which the card says in words.
  // A single dot on the map would say nothing.
  if (!walk || walk.coords.length < 2) return;

  const latlngs = walk.coords.map(([lon, lat]) => L.latLng(lat, lon));
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
  })
    .setLatLng(latlngs[latlngs.length - 1])
    .setContent(translate(language, 'map.walkMinutes', { n: walkMinutes(walk.lengthM) }))
    .addTo(layer);
}
