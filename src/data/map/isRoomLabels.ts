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
  /**
   * IS's campus code, when not Černá Pole. Labels repeat across campuses — IS's
   * "Aula" is building A's on Černá Pole and FRRMS's in budova Z on Černá Pole
   * II. — so a label is only unique together with its campus.
   */
  campus?: string;
}

/** The campus a label without one is on: every surveyed building is on Černá Pole. */
export const MAP_CAMPUS = 'ČP';

export const IS_ROOM_LABELS: readonly IsRoomLabel[] = isRoomLabelsJson;

/** Campuses where IS labels name a room the map draws. */
export const LABEL_CAMPUSES: ReadonlySet<string> = new Set(
  IS_ROOM_LABELS.map((l) => l.campus ?? MAP_CAMPUS)
);

const BY_CODE = new Map(IS_ROOM_LABELS.map((l) => [l.code, l.label]));

/** IS's label for a passport code, if IS lists that room. */
export function isLabelForCode(code: string | null | undefined): string | undefined {
  return code ? BY_CODE.get(code) : undefined;
}

// Case and spacing folded the way `normalizeRoomKey` does (lookupRoom imports
// this module, so it cannot be imported back).
const fold = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const key = (label: string, campus: string) => `${campus}|${fold(label)}`;
const CODE_BY_LABEL = new Map(
  IS_ROOM_LABELS.map((l) => [key(l.label, l.campus ?? MAP_CAMPUS), l.code])
);
const CAMPUS_BY_CODE = new Map(IS_ROOM_LABELS.map((l) => [l.code, l.campus ?? MAP_CAMPUS]));
// Labels that exist on exactly one campus, whichever it is.
const CAMPUSES_BY_LABEL = new Map<string, Set<string>>();
for (const l of IS_ROOM_LABELS) {
  const set = CAMPUSES_BY_LABEL.get(fold(l.label)) ?? new Set<string>();
  set.add(l.campus ?? MAP_CAMPUS);
  CAMPUSES_BY_LABEL.set(fold(l.label), set);
}

/**
 * The map room IS gives `name` on `campus`. A campus that was printed is taken
 * at its word, Černá Pole included ("Z14 (ČP)" is no room). With none printed
 * the room is on Černá Pole — or, when IS uses that label on one other campus
 * only ("Z14"), on that one: a bare label that names one room anywhere is not
 * ambiguous.
 */
export function codeForLabel(name: string, campus?: string): string | undefined {
  if (campus !== undefined) return CODE_BY_LABEL.get(key(name, campus));
  const exact = CODE_BY_LABEL.get(key(name, MAP_CAMPUS));
  if (exact) return exact;
  const only = CAMPUSES_BY_LABEL.get(fold(name));
  return only?.size === 1 ? CODE_BY_LABEL.get(key(name, [...only][0]!)) : undefined;
}

/** Whether IS gives `name` to a room the map draws on `campus` (Černá Pole by default). */
export function isMapRoomLabel(
  name: string | null | undefined,
  campus: string = MAP_CAMPUS
): boolean {
  return !!name && CODE_BY_LABEL.has(key(name, campus));
}

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
  const owner = CODE_BY_LABEL.get(key(name, CAMPUS_BY_CODE.get(code) ?? MAP_CAMPUS));
  return owner !== undefined && owner !== code;
}
