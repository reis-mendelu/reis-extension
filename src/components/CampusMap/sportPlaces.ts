import sportPlacesJson from '../../data/map/sportPlaces.json';
import type { SportPlace } from '../../types/campusMap';

/**
 * The Sportera places on the map. Bundled, not fetched: seven hand-picked public
 * courts change about as often as the campus does, and a release is how they
 * change. Picked 2026-11-13 from sportera.cz/city/brno, within ~550 m of a
 * campus building.
 */
export const SPORT_PLACES = (sportPlacesJson as { places: SportPlace[] }).places;
