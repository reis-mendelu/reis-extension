import type { RoomsCollection } from '../../types/campusMap';

/**
 * Room codes the campus map must not draw, by estate code.
 *
 * IS Mendelu's floor plans carry a handful of "rooms" that are not places a
 * student can be. BA27N1074 and BA27N1075 are two thin `type: "hall"` strips on
 * building M's first floor, drawn in the open air between the wings — not a
 * corridor, not even a terrace. They label empty ground and there is nothing to
 * go to, so they come off the map (Dominik, 2026-09-22).
 *
 * Denylisted by exact code on purpose: both are `type: "hall"` /
 * `category: "other"`, and filtering on either of those would take out every
 * hall on campus. The same two numbers in other buildings are real lecture
 * halls — BA01N1075 is A121, BA04N1074/75 are B5 and B4 — and stay.
 */
export const SUPPRESSED_ROOM_CODES: ReadonlySet<string> = new Set(['BA27N1074', 'BA27N1075']);

/**
 * Strips the suppressed rooms out of a floor-plan collection.
 *
 * Applied on the way OUT of the API rather than before the cache write: the
 * geometry is CDN data cached in IndexedDB for 30 days, so anyone who has
 * already opened building M holds an unfiltered copy. Filtering the value that
 * is returned — fresh, cached and stale-fallback alike — is what actually takes
 * the strips off their map.
 */
export function dropSuppressedRooms(rooms: RoomsCollection): RoomsCollection {
  const features = rooms.features.filter((f) => !SUPPRESSED_ROOM_CODES.has(f.properties.name));
  return features.length === rooms.features.length ? rooms : { ...rooms, features };
}
