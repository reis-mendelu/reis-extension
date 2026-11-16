import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
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

type Blocks = Record<number, Block[] | null | undefined>;

/**
 * Each room coloured for the day, or for the picked hours once there are some:
 * green when it is free for all of them, grey when not.
 */
export function libraryTints(
  blocks: Blocks,
  day: string,
  now: Date,
  lang: 'cz' | 'en',
  picked: readonly number[] = []
): Record<number, RoomTint> {
  const out: Record<number, RoomTint> = {};
  for (const r of LIBRARY_ROOMS) {
    const label = lang === 'cz' ? r.nameCs : r.nameEn;
    const b = blocks[r.featureId];
    if (b == null) {
      out[r.featureId] = { fill: TINT_PENDING, label, pending: true };
      continue;
    }
    const hours = freeHours(b, day, now);
    const free = picked.length ? picked.every((h) => hours.includes(h)) : hours.length > 0;
    out[r.featureId] = { fill: free ? TINT_FREE : TINT_FULL, label };
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
