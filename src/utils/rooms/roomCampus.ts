import isRoomPlacesJson from '../../data/map/isRoomPlaces.json';
import { LABEL_CAMPUSES, MAP_CAMPUS } from '../../data/map/isRoomLabels';

/**
 * IS's campus codes: every one `isRoomPlaces.json` or `isRoomLabels.json`
 * carries, plus Černá Pole's. Only these count as a campus in brackets, so a
 * bracket that is not a campus — a staff profile's "BA39N2056 (Q2.56)" —
 * decides nothing. A campus with no placed room (ŠLP) is missing from the set;
 * harmless while its one label names no map room.
 */
const IS_CAMPUSES = new Set([
  MAP_CAMPUS,
  ...LABEL_CAMPUSES,
  ...(isRoomPlacesJson as { campus: string }[]).map((p) => p.campus),
]);

/** The IS campus a printed room names in brackets ("Z14 (ČP II.)" → "ČP II."), or null. */
export function bracketCampus(raw: string | null | undefined): string | null {
  const inside = raw
    ?.trim()
    .match(/\(([^()]*)\)\s*$/)?.[1]
    ?.trim();
  return inside && IS_CAMPUSES.has(inside) ? inside : null;
}

/**
 * The campus a printed room names in brackets, when that campus is one the
 * map draws no rooms on.
 *
 * A timetable brackets the campus only off Černá Pole ("ZFAC1 (Led)",
 * "Aula (ČP II.)"). A room on a campus the map has no rooms for is never a map
 * room, however its name reads. Černá Pole II. is not such a campus since
 * budova Z got a floor plan (2026-09): its rooms are reached through IS's
 * labels for that campus (`codeForLabel`), which is also what keeps FRRMS's
 * "Aula" out of building A.
 */
export function offMapCampus(raw: string | null | undefined): string | null {
  const campus = bracketCampus(raw);
  return campus && !LABEL_CAMPUSES.has(campus) ? campus : null;
}
