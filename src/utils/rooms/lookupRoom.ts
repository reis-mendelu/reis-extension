import type { RoomIndexEntry } from '../../types/campusMap';

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
 * Handles the DATA makes ambiguous, where the room a timetable means is still
 * knowable — resolved by hand because the index does not carry what would
 * decide it automatically.
 *
 * Fifteen handles name more than one room. Only this one currently resolves to
 * the wrong kind of room: `index.find` reaches BA04P1011, a basement storage
 * room, before BA04N3022, the third-floor classroom, and IS schedules 83
 * lessons a semester into "B22". The map's geojson records `category` for both
 * (`service` vs `teaching`) but `rooms-index.json` does not, so there is
 * nothing to tiebreak on here; carrying `category` into the index upstream
 * would retire this map.
 *
 * The other ambiguous handles deliberately get no entry: B35 and C11 already
 * land on their classroom, B52 is two offices (which no timetable prints), and
 * E17 is two classrooms one floor apart with no tiebreak in the room string at
 * all. The frozen list in the test is what catches a new collision appearing.
 */
const PREFERRED_ROOM: Record<string, string> = {
  b22: 'BA04N3022',
};

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

/** The first entry any of `raw`'s candidate strings names, or null. */
export function lookupRoomEntry(
  raw: string | null | undefined,
  index: RoomIndexEntry[]
): RoomIndexEntry | null {
  if (!raw) return null;
  for (const candidate of candidates(raw)) {
    const needle = normalizeRoomKey(candidate);
    if (!needle) continue;
    const preferred = PREFERRED_ROOM[needle];
    if (preferred) {
      const pick = index.find((e) => e.code === preferred);
      if (pick) return pick;
    }
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
