import type { MapSelection, SocietyPin } from '../../types/campusMap';

/**
 * Venues (S-klub's café, the `venues` table) in the map search, and on their
 * room in a floor plan. Both come from `venuePins`, so a venue added to the
 * table is found and labelled with no code change.
 */

/** Lowercase, without diacritics: "Kavárna" and "kavarna" are one word. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** Letters and digits only, so "sklub", "s klub" and "S-klub" meet. */
const compact = (s: string) => fold(s).replace(/[^\p{L}\p{N}]/gu, '');

/** What a student might type for a venue: its name and what kind of place it is. */
function venueWords(pin: SocietyPin): string[] {
  const v = pin.venue;
  return v ? [pin.title, v.kind.cz, v.kind.en] : [];
}

/**
 * How well `query` names this venue, ranked the way mapHelpers ranks rooms
 * (0 exact, 2 prefix, 4 anywhere inside); null when it does not.
 */
function venueRank(query: string, pin: SocietyPin): number | null {
  const q = fold(query);
  const qc = compact(query);
  if (!qc) return null;
  const words = venueWords(pin);
  const folded = words.map(fold);
  const compacted = words.map(compact);
  if (folded.includes(q) || compacted.includes(qc)) return 0;
  if (folded.some((w) => w.startsWith(q)) || compacted.some((w) => w.startsWith(qc))) return 2;
  if (folded.some((w) => w.includes(q)) || compacted.some((w) => w.includes(qc))) return 4;
  return null;
}

/** Venue results for the map search, tagged with their rank. */
export function rankedVenues(
  query: string,
  pins: readonly SocietyPin[]
): { sel: MapSelection; rank: number }[] {
  return pins.flatMap((pin) => {
    const rank = venueRank(query, pin);
    return rank === null ? [] : [{ sel: { kind: 'societyPin', pin } as MapSelection, rank }];
  });
}

/** The venues `query` names, best first. */
export function searchVenues(query: string, pins: readonly SocietyPin[]): SocietyPin[] {
  return rankedVenues(query, pins)
    .sort((a, b) => a.rank - b.rank)
    .flatMap((x) => (x.sel.kind === 'societyPin' ? [x.sel.pin] : []));
}

/**
 * IS room code → venue title, for the floor plan: S-klub's room (BZ00N1015)
 * reads "S-klub Pixie", the name from the table, not a code or a nickname.
 */
export function venueRoomTitles(pins: readonly SocietyPin[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const pin of pins) {
    const code = pin.venue?.roomCode;
    if (code) titles.set(code.toUpperCase(), pin.title);
  }
  return titles;
}
