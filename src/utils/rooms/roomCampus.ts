import isRoomPlacesJson from '../../data/map/isRoomPlaces.json';

/**
 * The campus a printed room names in brackets, when that campus is one the
 * map draws no rooms on.
 *
 * A timetable brackets the campus only off Černá Pole ("ZFAC1 (Led)",
 * "Aula (ČP II.)"), and all seven buildings the map draws rooms for are on
 * Černá Pole. So a room with an off-map campus is never a map room, however
 * its name reads: IS has an "Aula" in building A and another in FRRMS's
 * building Z, and matching the name alone sent the FRRMS one to building A.
 *
 * Only IS's own campus codes count (every one `isRoomPlaces.json` carries), so
 * a bracket that is not a campus — a staff profile's "BA39N2056 (Q2.56)" —
 * decides nothing.
 */
const MAP_CAMPUS = 'ČP';

const OFF_MAP_CAMPUSES = new Set(
  (isRoomPlacesJson as { campus: string }[]).map((p) => p.campus).filter((c) => c !== MAP_CAMPUS)
);

export function offMapCampus(raw: string | null | undefined): string | null {
  const inside = raw
    ?.trim()
    .match(/\(([^()]*)\)\s*$/)?.[1]
    ?.trim();
  return inside && OFF_MAP_CAMPUSES.has(inside) ? inside : null;
}
