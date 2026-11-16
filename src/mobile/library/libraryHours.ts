import { LIBRARY_ROOMS } from '../../data/map/libraryRooms';
import type { Block } from './availability';
import { freeHours } from './slots';
import { HOURS, hourGone } from './libraryDay';

/** Per map room id; `undefined` = not read yet, `null` = could not ask. */
export type RoomBlocks = Record<number, Block[] | null | undefined>;

export type HourState = 'past' | 'taken' | 'free';
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
  return HOURS.map((hour) => {
    const free = [...byRoom.values()].filter((hs) => hs.includes(hour)).length;
    const state: HourState = free > 0 ? 'free' : hourGone(day, hour, now) ? 'past' : 'taken';
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
