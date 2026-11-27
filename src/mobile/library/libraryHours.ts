import type { Block } from './availability';
import { DAILY_CAP, freeHours } from './slots';
import { libraryRoomOf, type OwnBooking } from './ownBooking';
import { bookedOn } from './bookingService';

/** Per map room id; `undefined` = not read yet, `null` = could not ask. */
export type RoomBlocks = Record<number, Block[] | null | undefined>;

/**
 * The library's answer with the student's own bookings laid over it as taken.
 * Bookings shows a fresh booking as free for a while (seen 2026-11-16: two
 * rooms booked for Friday 9:00 still offered at 9:00 minutes later), and only
 * this device knows better, so its calendar wins over the library's lag.
 */
export function withOwnBookings(blocks: RoomBlocks, events: readonly OwnBooking[]): RoomBlocks {
  const out: RoomBlocks = { ...blocks };
  for (const e of events) {
    const id = libraryRoomOf(e);
    const list = id === null ? undefined : out[id];
    if (!list) continue;
    const day = `${e.date.slice(0, 4)}-${e.date.slice(4, 6)}-${e.date.slice(6, 8)}`;
    out[id!] = [
      ...list,
      { status: 'busy', start: `${day}T${e.startTime}`, end: `${day}T${e.endTime}` },
    ];
  }
  return out;
}

/**
 * The new end hour if a booking can take one more hour: the next hour of that
 * room is free (the student's own bookings counted), inside opening hours and
 * under the daily cap. `null` otherwise, and while the library has not answered.
 */
export function canExtend(
  blocks: RoomBlocks,
  events: readonly OwnBooking[],
  block: OwnBooking,
  now: Date
): number | null {
  const id = libraryRoomOf(block);
  if (id === null) return null;
  const day = `${block.date.slice(0, 4)}-${block.date.slice(4, 6)}-${block.date.slice(6, 8)}`;
  const end = Number(block.endTime.slice(0, 2));
  const seen = withOwnBookings(blocks, events)[id];
  if (!seen || !freeHours(seen, day, now).includes(end)) return null;
  return bookedOn([...events], day) < DAILY_CAP ? end + 1 : null;
}
