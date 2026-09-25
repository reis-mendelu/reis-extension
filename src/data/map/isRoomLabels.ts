import isRoomLabelsJson from './isRoomLabels.json';

/**
 * The label IS prints for a map room, paired by estate number.
 *
 * The MENDELU map knows a room as "BA04N1065" and, for some rooms only, a
 * hand-typed nickname. A timetable prints "B05 – Strojový sál". IS's public
 * room catalogue lists each classroom's estate number ("Číslo: N1065"), which
 * is the tail of the map's passport code — so reis-data pairs them
 * (`scripts/pairIsRooms.mjs`, fed by reis-scraper's
 * `scripts/scrape-room-catalogue.ts`) and `buildMapData.mjs` emits this file.
 * Regenerate it there; do not hand-edit.
 *
 * IS is the authority on what a room is called: where the map's nickname
 * disagrees (the map's "B40" is IS's B06), the IS label wins, because that is
 * the string a student reads off their timetable.
 */
export interface IsRoomLabel {
  code: string;
  label: string;
}

export const IS_ROOM_LABELS: readonly IsRoomLabel[] = isRoomLabelsJson;

const BY_CODE = new Map(IS_ROOM_LABELS.map((l) => [l.code, l.label]));

/** IS's label for a passport code, if IS lists that room. */
export function isLabelForCode(code: string | null | undefined): string | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

// Case and spacing folded the way `normalizeRoomKey` does (lookupRoom imports
// this module, so it cannot be imported back).
const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const CODE_BY_LABEL = new Map(IS_ROOM_LABELS.map((l) => [fold(l.label), l.code]));

/**
 * Whether IS gives `name` to a DIFFERENT room than `code`. The map nicknames
 * BA01N4082 "A412", but IS's A412 is BA01N5036 a floor up; showing or matching
 * the map's copy puts two A412s on the plan. False when `code` is unknown.
 */
export function isLabelOfAnotherRoom(
  name: string | null | undefined,
  code: string | null | undefined
): boolean {
  if (!name || !code) return false;
  const owner = CODE_BY_LABEL.get(fold(name));
  return owner !== undefined && owner !== code;
}
