import sportPlacesJson from '../../data/map/sportPlaces.json';
import type { SportPlace } from '../../types/campusMap';

/**
 * The Sportera places on the map. Bundled, not fetched: seven hand-picked public
 * courts change about as often as the campus does, and a release is how they
 * change. Picked 2026-11-13 from sportera.cz/city/brno, within ~550 m of a
 * campus building.
 */
export const SPORT_PLACES = (sportPlacesJson as { places: SportPlace[] }).places;

/** [[south, west], [north, east]] around every place: what "Sport" fits the camera to. */
export const SPORT_BOUNDS: [[number, number], [number, number]] = [
  [
    Math.min(...SPORT_PLACES.map((p) => p.coord[1])),
    Math.min(...SPORT_PLACES.map((p) => p.coord[0])),
  ],
  [
    Math.max(...SPORT_PLACES.map((p) => p.coord[1])),
    Math.max(...SPORT_PLACES.map((p) => p.coord[0])),
  ],
];
