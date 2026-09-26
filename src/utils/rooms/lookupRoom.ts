import type { RoomIndexEntry } from '../../types/campusMap';
import { IS_ROOM_LABELS } from '../../data/map/isRoomLabels';
import { offMapCampus } from './roomCampus';

/**
 * One room string off IS → the index entry the map can actually show.
 *
 * Every lookup in the app funnels through here because they used to disagree.
 * `focusRoomByCode` and `resolveRoomCode` matched `code` or `name` only, while
 * the map's own search also matched `nickname` — so a student could FIND a room
 * in search that the "show on map" button could not navigate to.
 *
 * That asymmetry is not cosmetic, because the two fields are populated per
 * building. PEF's building Q puts the friendly hall code in `name` ("Q01"), so
 * PEF worked. Buildings A/B/C/E/M put the raw passport code in `name`
 * ("BA01N1052") and the friendly code a timetable prints in `nickname` ("A01").
 * 739 of the index's 2189 rooms — every teaching room outside Q — were reachable
 * by nickname alone, so for everyone outside PEF the button did nothing.
 */

/**
 * The key two room strings are compared on: case and spacing only.
 *
 * Deliberately NOT normalizing zero padding or dots. Measured over the whole
 * index, folding those takes ambiguous keys from 16 to 77, and the new
 * ambiguity is between floors — "Q1.05" is above ground, "Q01.05" below.
 * A button that opens the wrong floor is worse than one that does nothing.
 */
export function normalizeRoomKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

// IS schedules lessons into rooms that are not places: distance teaching blocks
// ("B Virtuální 6"), online seminars. There is nothing to show on a map, and
// failing to find one is not a defect — callers use this to stay quiet about it.
const NON_PHYSICAL = /virtu[aá]ln|virtual|online|distan[cč]|e-?learning/i;

export function isNonPhysicalRoom(raw: string | null | undefined): boolean {
  return !!raw && NON_PHYSICAL.test(raw);
}

/**
 * The strings a single printed room may be hiding.
 *
 * IS brackets a second string after the room and it is not always the same
 * kind of thing: a timetable prints the campus ("Q01 (Poříčí)"), a staff
 * profile prints the friendly name beside the estate code
 * ("BA39N2056 (Q2.56)"). Either half can be the handle, so both are tried —
 * outside first, since that is the room proper far more often.
 */
function candidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const out = [trimmed];
  const bracketed = trimmed.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (bracketed) {
    const [, outside, inside] = bracketed;
    if (outside?.trim()) out.push(outside.trim());
    if (inside?.trim()) out.push(inside.trim());
  }
  return out;
}

/**
 * Handles that name rooms in more than one PLACE, and the one a timetable means.
 *
 * Fifteen handles in the index are carried by two or more rooms, but ten of
 * those are duplicates within a single building and floor — byte-identical rows
 * (three "BA27" in building M) or a descriptive nickname shared by neighbours
 * ("Učebna agronomické fakulty."). Picking the first of those is harmless; a
 * student cannot tell.
 *
 * Five are not: B22, B35, B52, C11 and E17 each name rooms on different floors.
 * For three of them the map's geojson settles it by `category`, which
 * `rooms-index.json` does not carry — so the answer is written down here with
 * its evidence, and carrying `category` into the index upstream would retire
 * this table:
 *
 *   B22  BA04P1011 service  floor -1  vs  BA04N3022 teaching floor 3   (83 lessons)
 *   B35  BA04N1033 office   floor  1  vs  BA04N4036 teaching floor 4  (100 lessons)
 *   C11  BA03N1046 office   floor  0  vs  BA03N2045 teaching floor 1   (26 lessons)
 *
 * B35 and C11 already resolved to their classroom, but only by array order;
 * pinning them stops a reordered index moving 126 lessons a semester into
 * someone's office.
 *
 * B52 (two offices) and E17 (two classrooms) get no entry on purpose. Nothing
 * in the room string can break those ties, so `lookupRoomEntry` returns null
 * for them rather than guessing — see `ambiguousHandles`.
 */
const PREFERRED_ROOM: Record<string, string> = {
  b22: 'BA04N3022',
  b35: 'BA04N4036',
  c11: 'BA03N2045',
};

/**
 * Every handle that names rooms in two or more distinct (building, floor)
 * pairs. Without a `PREFERRED_ROOM` entry these must not resolve at all: a
 * coin flip between two floors looks exactly as confident as a real answer,
 * and the caller has no way to know it was a guess. Returning null is the
 * honest outcome and the UI already withholds its map controls for one.
 *
 * Computed once per index array — the app has exactly one — and cached weakly
 * so a test passing a stub index gets its own answer.
 */
const ambiguousCache = new WeakMap<RoomIndexEntry[], Set<string>>();

function ambiguousHandles(index: RoomIndexEntry[]): Set<string> {
  const cached = ambiguousCache.get(index);
  if (cached) return cached;
  const places = new Map<string, Set<string>>();
  for (const e of index) {
    for (const handle of [e.code, e.name, e.nickname]) {
      if (!handle || !handle.trim()) continue;
      const key = normalizeRoomKey(handle);
      const seen = places.get(key) ?? new Set<string>();
      seen.add(`${e.buildingId}/${e.floorId}`);
      places.set(key, seen);
    }
  }
  const out = new Set<string>();
  for (const [key, seen] of places) if (seen.size > 1) out.add(key);
  ambiguousCache.set(index, out);
  return out;
}

// Field precedence within one candidate: the estate code is unique, the printed
// name next, the nickname last (nicknames are the only field that repeats — two
// rooms are both called "E17", and a few carry a descriptive title instead of a
// code). Exact beats folded across the board so this can only ADD resolutions,
// never change one that already worked.
const FIELDS: ((e: RoomIndexEntry) => string | null | undefined)[] = [
  (e) => e.code,
  (e) => e.name,
  (e) => e.nickname,
];

/**
 * IS's own answer: timetable label → passport code, from IS's room catalogue
 * (see `data/map/isRoomLabels.ts`). Consulted before anything the map says,
 * because the room string being resolved IS an IS label. It settles ties the
 * map cannot (E17), agrees with every `PREFERRED_ROOM` entry, and outranks two
 * map nicknames that sit a floor below IS's rooms (A411, A412).
 */
const IS_CODE_BY_LABEL = new Map(IS_ROOM_LABELS.map((l) => [normalizeRoomKey(l.label), l.code]));

/** The first entry any of `raw`'s candidate strings names, or null. */
export function lookupRoomEntry(
  raw: string | null | undefined,
  index: RoomIndexEntry[]
): RoomIndexEntry | null {
  // "Aula (ČP II.)" is FRRMS's aula, not building A's — no map room at all.
  if (!raw || offMapCampus(raw)) return null;
  for (const candidate of candidates(raw)) {
    const needle = normalizeRoomKey(candidate);
    if (!needle) continue;
    // Only when the index at hand has that room — a stub index falls through.
    const isCode = IS_CODE_BY_LABEL.get(needle);
    if (isCode) {
      const hit = index.find((e) => e.code === isCode);
      if (hit) return hit;
    }
    const preferred = PREFERRED_ROOM[needle];
    if (preferred) {
      const pick = index.find((e) => e.code === preferred);
      if (pick) return pick;
    }
    // Ambiguous across floors with nothing to decide it: skip to the next
    // candidate rather than returning a room we cannot stand behind.
    if (ambiguousHandles(index).has(needle)) continue;
    for (const field of FIELDS) {
      const exact = index.find((e) => field(e) === candidate);
      if (exact) return exact;
    }
    for (const field of FIELDS) {
      const folded = index.find((e) => {
        const v = field(e);
        return !!v && normalizeRoomKey(v) === needle;
      });
      if (folded) return folded;
    }
  }
  return null;
}
