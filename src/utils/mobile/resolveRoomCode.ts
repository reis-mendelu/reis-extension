import roomsIndex from '../../data/map/rooms-index.json';

interface RoomIndexEntry {
  code: string;
  name: string;
  nickname: string | null;
}

const INDEX = roomsIndex as RoomIndexEntry[];

export interface ResolvedRoom {
  /** What to hand `focusRoomByCode`. */
  code: string;
  /** What to show the student. */
  label: string;
}

/**
 * The first of several candidate room strings that the campus map can actually
 * find, with the label a student would recognise.
 *
 * Rooms carry up to three names and IS hands out different ones in different
 * places: a profile's office cell gives the estate code AND the friendly name
 * ("BA39N2056 (Q2.56)"), while a schedule gives the room as printed on the
 * timetable, sometimes with a campus in brackets ("Q01 (Poříčí)"). The map's
 * index matches `code` or `name`, so which string arrives decides whether a
 * lookup succeeds.
 *
 * Resolving BEFORE rendering is the point: `focusRoomByCode` only reports an
 * unknown room to telemetry, so an unresolvable code becomes a button that
 * looks fine and does nothing. Callers offer the button only if this returns.
 */
export function resolveRoomCode(candidates: (string | null | undefined)[]): ResolvedRoom | null {
  for (const raw of candidates) {
    if (!raw) continue;
    // Schedules print the campus in brackets after the room; the index does not.
    const cleaned = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!cleaned) continue;

    const entry = INDEX.find((e) => e.code === cleaned || e.name === cleaned);
    if (entry) {
      // The friendliest name the room has: a nickname ("A01") beats the
      // printed name ("Q2.56"), which beats the estate code.
      return { code: entry.code, label: entry.nickname || entry.name || entry.code };
    }
  }
  return null;
}
