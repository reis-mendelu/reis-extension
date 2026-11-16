import { LIBRARY_ROOMS, type LibraryRoom } from '../../data/map/libraryRooms';
import type { RoomTint } from '../../types/campusMap';
import type { Block } from './availability';
import { freeHours } from './slots';

/**
 * Colour says one thing: green has an hour to book on the shown day, grey does
 * not. It used to say two (blue = individual, green = team, grey = full), and a
 * student read blue-or-green as "free". The list groups rooms by size instead.
 */
export const TINT_FREE = '#16a34a';
export const TINT_FULL = '#9ca3af';
/** Not known yet: faint, dashed (roomTints.ts), never a colour that reads as free. */
export const TINT_PENDING = '#cbd5e1';

type Blocks = Record<number, Block[] | null>;

export function libraryTints(
  blocks: Blocks,
  day: string,
  now: Date,
  lang: 'cz' | 'en'
): Record<number, RoomTint> {
  const out: Record<number, RoomTint> = {};
  for (const r of LIBRARY_ROOMS) {
    const label = lang === 'cz' ? r.nameCs : r.nameEn;
    const b = blocks[r.featureId];
    out[r.featureId] =
      b == null
        ? { fill: TINT_PENDING, label, pending: true }
        : { fill: freeHours(b, day, now).length > 0 ? TINT_FREE : TINT_FULL, label };
  }
  return out;
}

/** The count on the campus pin: rooms with at least one bookable hour on the shown day. */
export function roomsOpenCount(blocks: Blocks, day: string, now: Date): number {
  return LIBRARY_ROOMS.filter((r) => {
    const b = blocks[r.featureId];
    return b != null && freeHours(b, day, now).length > 0;
  }).length;
}

/** The rooms by how many people they hold: the question a student actually has. */
export function sizeGroups(): { seats: number; rooms: LibraryRoom[] }[] {
  const by = new Map<number, LibraryRoom[]>();
  for (const r of LIBRARY_ROOMS) by.set(r.seats, [...(by.get(r.seats) ?? []), r]);
  return [...by.entries()].sort(([a], [b]) => a - b).map(([seats, rooms]) => ({ seats, rooms }));
}
