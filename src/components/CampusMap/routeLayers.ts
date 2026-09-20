import L from 'leaflet';
import { translate } from '../../i18n/translate';
import { walkMinutes } from '../../utils/walkTime';
import type { Walk } from '../../utils/routing/shortestWalk';

/**
 * The computed route, drawn.
 *
 * While a route is up it is the loudest thing on the map, because it is the
 * answer to the question that was just asked. The campus network underneath
 * stays the quiet dotted trail it already is, and the entrance fan's orange is
 * left alone — blue here so the two never read as the same thing: the fan is
 * "here are your options from this gate", this is "here is your way".
 *
 * Fixed colour literals, like every other style on this map. The basemap is
 * always light whatever the app theme is (see the note above CATEGORY_STYLE in
 * mapLayers), so a theme token here would be the one thing that inverts.
 */
const HALO: L.PathOptions = {
  color: '#ffffff',
  weight: 9,
  opacity: 0.95,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
const LINE: L.PathOptions = {
  color: '#2563eb',
  weight: 5,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  interactive: false,
};
/** Where you are. Filled white so it reads as a position, not as a waypoint. */
const START: L.CircleMarkerOptions = {
  radius: 6,
  color: '#2563eb',
  weight: 3,
  fillColor: '#ffffff',
  fillOpacity: 1,
  interactive: false,
};

/**
 * Redraw the route from scratch.
 *
 * Clear-and-rebuild rather than mutate: a route is recomputed once per tap, not
 * per frame, so there is nothing to save by diffing — and a layer that
 * accumulates stale polylines is the bug this shape makes impossible.
 */
export function drawRoute(layer: L.LayerGroup, walk: Walk | null, language: string): void {
  layer.clearLayers();
  // A one-point walk is "you are already there", which the card says in words.
  // A single dot on the map would say nothing.
  if (!walk || walk.coords.length < 2) return;

  const latlngs = walk.coords.map(([lon, lat]) => L.latLng(lat, lon));
  L.polyline(latlngs, HALO).addTo(layer);
  L.polyline(latlngs, LINE).addTo(layer);
  L.circleMarker(latlngs[0], START).addTo(layer);

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
