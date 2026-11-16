import type { Block } from './availability';
import { FIRST_HOUR, LAST_HOUR, NOTICE_MS, freeHours, isWeekday } from './slots';

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (day: string, hour = 0): Date => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour);
};
const nextDay = (day: string): string => {
  const d = dateOf(day);
  d.setDate(d.getDate() + 1);
  return isoDay(d);
};

/** Every hour the library sells, as the start hour. */
export const HOURS: readonly number[] = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, i) => FIRST_HOUR + i
);

/** Whether the clock still leaves an hour of `day` to book (opening hours and notice). */
const stillBookable = (day: string, now: Date): boolean =>
  isWeekday(day) && dateOf(day, LAST_HOUR).getTime() >= now.getTime() + NOTICE_MS;

/**
 * The day the library card is about: today while today can still be booked,
 * otherwise the next weekday, flagged so the card says it moved on. After 19:00
 * every room used to read "dnes plno", which was true and useless.
 */
export function shownDay(now: Date): { day: string; today: boolean } {
  let day = isoDay(now);
  if (stillBookable(day, now)) return { day, today: true };
  do day = nextDay(day);
  while (!isWeekday(day));
  return { day, today: false };
}

/** Five weekdays starting at `from` (the room view's day chips, no scrolling). */
export function weekdaysFrom(from: string, count = 5): string[] {
  const out: string[] = [];
  for (let day = from; out.length < count; day = nextDay(day)) if (isWeekday(day)) out.push(day);
  return out;
}

export type HourState = 'past' | 'taken' | 'free';
export interface HourCell {
  hour: number;
  state: HourState;
  /** The student has a class in this hour (marked, still bookable). */
  lesson: boolean;
}

/**
 * Each hour of a day as the grid draws it. "Past" is an hour the clock has
 * closed (gone, or inside the library's hour of notice); "taken" is an hour
 * someone else has. They used to look the same, struck through.
 */
export function hourStates(
  blocks: Block[],
  day: string,
  now: Date,
  lessons: ReadonlySet<number>
): HourCell[] {
  const free = freeHours(blocks, day, now);
  return HOURS.map((hour) => {
    const gone = dateOf(day, hour).getTime() < now.getTime() + NOTICE_MS;
    const state: HourState = free.includes(hour) ? 'free' : gone ? 'past' : 'taken';
    return { hour, state, lesson: lessons.has(hour) };
  });
}

/**
 * One tap on an hour. A selection is a run of consecutive free hours, because
 * one booking is one stretch of time: a neighbour grows it (up to `room` hours,
 * what is left of the daily cap), an end shrinks it, any other free hour starts
 * over. A middle hour does nothing: dropping it would split the booking in two.
 */
export function toggleHour(
  sel: readonly number[],
  hour: number,
  free: readonly number[],
  room: number
): number[] {
  if (!free.includes(hour)) return [...sel];
  if (sel.length === 0) return room > 0 ? [hour] : [];
  const lo = sel[0]!;
  const hi = sel[sel.length - 1]!;
  if (hour === lo) return sel.slice(1);
  if (hour === hi) return sel.slice(0, -1);
  if (hour > lo && hour < hi) return [...sel];
  if (hour === lo - 1 || hour === hi + 1)
    return sel.length >= room ? [...sel] : [...sel, hour].sort((a, b) => a - b);
  return [hour];
}

/** A selection as one span, `to` exclusive. */
export const rangeOf = (sel: readonly number[]): { from: number; to: number } | null =>
  sel.length === 0 ? null : { from: sel[0]!, to: sel[sel.length - 1]! + 1 };

export type RoomStatus =
  { kind: 'loading' } | { kind: 'unknown' } | { kind: 'full' } | { kind: 'from'; hour: number };

/**
 * What the list says about a room for the shown day. While the library has not
 * answered it says so, and nothing reads as free: for the 10–16 s the answer
 * takes, every room used to look bookable and then turn grey.
 */
export function roomStatus(
  blocks: Block[] | null | undefined,
  day: string,
  now: Date,
  loading: boolean
): RoomStatus {
  if (blocks === undefined || (loading && !blocks)) return { kind: 'loading' };
  if (blocks === null) return { kind: 'unknown' };
  const hours = freeHours(blocks, day, now);
  return hours.length ? { kind: 'from', hour: hours[0]! } : { kind: 'full' };
}

/** The first free hour on any of `days`, for a day that turned out full. */
export function nextFree(
  blocks: Block[],
  days: readonly string[],
  now: Date
): { day: string; hour: number } | null {
  for (const day of days) {
    const hour = freeHours(blocks, day, now)[0];
    if (hour !== undefined) return { day, hour };
  }
  return null;
}

/** The library hours of `day` that overlap one of the student's own classes. */
export function lessonHours(
  lessons: readonly { date: string; startTime: string; endTime: string; isCustom?: boolean }[],
  day: string
): Set<number> {
  const compact = day.replaceAll('-', '');
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  const out = new Set<number>();
  for (const l of lessons) {
    if (l.isCustom || l.date !== compact) continue;
    for (const h of HOURS)
      if (mins(l.startTime) < (h + 1) * 60 && mins(l.endTime) > h * 60) out.add(h);
  }
  return out;
}
