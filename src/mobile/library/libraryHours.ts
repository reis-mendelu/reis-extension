import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import type { Block } from './availability';
import { DAILY_CAP, freeHours } from './slots';
import { HOURS, hourGone } from './libraryDay';
import { libraryRoomOf, type OwnBooking } from './ownBooking';
import { bookedOn } from './bookingService';

/** Per map room id; `undefined` = not read yet, `null` = could not ask. */
export type RoomBlocks = Record<number, Block[] | null | undefined>;

/** `unknown`: no room is known free, but some room's hours could not be read. */
export type HourState = 'past' | 'taken' | 'free' | 'unknown';
export interface HourCell {
  hour: number;
  state: HourState;
  /** How many rooms are free in this hour. */
  free: number;
  /** The student has a class in this hour (marked, still bookable). */
  lesson: boolean;
}

/** Each room's bookable hours of `day`. */
function freeByRoom(blocks: RoomBlocks, day: string, now: Date): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const r of LIBRARY_ROOMS) {
    const b = blocks[r.featureId];
    out.set(r.featureId, b ? freeHours(b, day, now) : []);
  }
  return out;
}

/**
 * The day's hours across the whole library: an hour is free while ANY room is.
 * The student's question is "when can I study", then "where" (Dominik,
 * 2026-11-16), so the hours come first and the rooms are what an hour offers.
 */
export function hourCells(
  blocks: RoomBlocks,
  day: string,
  now: Date,
  lessons: ReadonlySet<number>
): HourCell[] {
  const byRoom = freeByRoom(blocks, day, now);
  // A room the library did not answer for is "could not ask", never "full".
  const unanswered = LIBRARY_ROOMS.some((r) => blocks[r.featureId] === null);
  return HOURS.map((hour) => {
    const free = [...byRoom.values()].filter((hs) => hs.includes(hour)).length;
    const state: HourState =
      free > 0 ? 'free' : hourGone(day, hour, now) ? 'past' : unanswered ? 'unknown' : 'taken';
    return { hour, state, free, lesson: lessons.has(hour) };
  });
}

/** The rooms free for every hour of `hours`, smallest first. */
export function roomsFreeFor(
  blocks: RoomBlocks,
  day: string,
  now: Date,
  hours: readonly number[]
): number[] {
  if (hours.length === 0) return [];
  const byRoom = freeByRoom(blocks, day, now);
  return LIBRARY_ROOMS.filter((r) => hours.every((h) => byRoom.get(r.featureId)!.includes(h)))
    .sort((a, b) => a.seats - b.seats)
    .map((r) => r.featureId);
}

/**
 * One tap on an hour. A pick is a run of consecutive hours that at least one
 * room has free throughout (`fits`), because one booking is one room for one
 * stretch: a neighbour grows it (up to `room` hours, what is left of the daily
 * cap), an end shrinks it, any other hour starts over. A middle hour does
 * nothing: dropping it would split the stretch in two.
 */
export function toggleHour(
  sel: readonly number[],
  hour: number,
  fits: (hours: number[]) => boolean,
  room: number
): number[] {
  if (sel.length === 0) return room > 0 && fits([hour]) ? [hour] : [];
  const lo = sel[0]!;
  const hi = sel[sel.length - 1]!;
  if (hour === lo) return sel.slice(1);
  if (hour === hi) return sel.slice(0, -1);
  if (hour > lo && hour < hi) return [...sel];
  if (hour === lo - 1 || hour === hi + 1) {
    const next = [...sel, hour].sort((a, b) => a - b);
    return sel.length < room && fits(next) ? next : [...sel];
  }
  return fits([hour]) ? [hour] : [...sel];
}

/** A pick as one span, `to` exclusive. */
export const rangeOf = (sel: readonly number[]): { from: number; to: number } | null =>
  sel.length === 0 ? null : { from: sel[0]!, to: sel[sel.length - 1]! + 1 };

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
