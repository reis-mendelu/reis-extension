import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import type { RoomBlocks } from './libraryHours';
import { freeHours } from './slots';
import { HOURS, hourGone } from './libraryDay';
import { hoursOf, libraryRoomOf, type OwnBooking } from './ownBooking';

/**
 * `mine`: the student's own booking. `unknown`: the library did not answer for
 * that room, which is not "taken" and never offered.
 */
export type CellState = 'free' | 'taken' | 'mine' | 'unknown';

export interface GridRow {
  hour: number;
  /** Per map room id. */
  cells: Record<number, CellState>;
  /** One of the student's classes overlaps this hour (still bookable). */
  lesson: boolean;
}

/** The room and the consecutive hours picked in it, in order. */
export interface GridPick {
  room: number;
  hours: number[];
}

/**
 * The day as rows of hours and one cell per room. Hours already gone (or inside
 * the library's hour of notice) are not rows at all: at lunchtime they were half
 * the screen. The library's answer is read with the student's own bookings laid
 * over it, which is what `withOwnBookings` is for; the caller does that.
 */
export function gridRows(
  blocks: RoomBlocks,
  day: string,
  now: Date,
  lessons: ReadonlySet<number>,
  own: readonly OwnBooking[]
): GridRow[] {
  const mine = new Set<string>();
  const compact = day.replaceAll('-', '');
  for (const e of own) {
    const room = libraryRoomOf(e);
    if (room === null || e.date !== compact) continue;
    const from = Number(e.startTime.slice(0, 2));
    for (let h = from; h < from + hoursOf(e); h++) mine.add(`${room}:${h}`);
  }
  const free = new Map(
    LIBRARY_ROOMS.map((r) => {
      const b = blocks[r.featureId];
      return [r.featureId, b ? new Set(freeHours(b, day, now)) : null] as const;
    })
  );
  return HOURS.filter((hour) => !hourGone(day, hour, now)).map((hour) => {
    const cells: Record<number, CellState> = {};
    for (const r of LIBRARY_ROOMS) {
      const f = free.get(r.featureId);
      cells[r.featureId] = mine.has(`${r.featureId}:${hour}`)
        ? 'mine'
        : f === null
          ? 'unknown'
          : f!.has(hour)
            ? 'free'
            : 'taken';
    }
    return { hour, cells, lesson: lessons.has(hour) };
  });
}

type StateOf = (room: number, hour: number) => CellState;

const isFree = (state: StateOf, room: number, hour: number) => state(room, hour) === 'free';

/**
 * One tap on a cell. The pick is one room and a run of consecutive hours, because
 * one booking is one room for one stretch. A free neighbour of the run grows it
 * (up to `left`, what the day's allowance still holds), an end shrinks it, and a
 * free cell anywhere else starts a new pick there. Nothing else does anything.
 */
export function tapCell(
  pick: GridPick | null,
  room: number,
  hour: number,
  state: StateOf,
  left: number
): GridPick | null {
  if (left <= 0) return pick;
  if (pick && pick.room === room) {
    const lo = pick.hours[0]!;
    const hi = pick.hours[pick.hours.length - 1]!;
    if (hour === lo && hour === hi) return null;
    if (hour === lo) return { room, hours: pick.hours.slice(1) };
    if (hour === hi) return { room, hours: pick.hours.slice(0, -1) };
    if ((hour === lo - 1 || hour === hi + 1) && isFree(state, room, hour)) {
      if (pick.hours.length >= left) return pick;
      return { room, hours: [...pick.hours, hour].sort((a, b) => a - b) };
    }
  }
  return isFree(state, room, hour) ? { room, hours: [hour] } : pick;
}

/** The hours that show a "+": free cells right above and below the pick, while it can still grow. */
export function growHours(pick: GridPick | null, state: StateOf, left: number): number[] {
  if (!pick || pick.hours.length === 0 || pick.hours.length >= left) return [];
  const lo = pick.hours[0]!;
  const hi = pick.hours[pick.hours.length - 1]!;
  return [lo - 1, hi + 1].filter((h) => isFree(state, pick.room, h));
}

/** A pick as one span, `to` exclusive. */
export const spanOf = (pick: GridPick | null): { from: number; to: number } | null =>
  pick && pick.hours.length
    ? { from: pick.hours[0]!, to: pick.hours[pick.hours.length - 1]! + 1 }
    : null;
