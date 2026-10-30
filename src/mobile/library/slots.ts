import type { Block } from './availability';

/** Students book whole hours; Bookings itself allows 15-minute steps. */
const FIRST_HOUR = 7;
const LAST_HOUR = 18; // the 18:00–19:00 hour is the last one
/** Lead time of the library's services (PT1H). */
const NOTICE_MS = 60 * 60 * 1000;
/** A soft limit counted on the device, so one student cannot take a whole room for a day. */
export const DAILY_CAP = 4;

export const overCap = (bookedToday: number): boolean => bookedToday >= DAILY_CAP;

const at = (day: string, hour: number): string => `${day}T${String(hour).padStart(2, '0')}:00`;

const isWeekday = (day: string): boolean => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dow = new Date(y, m - 1, d).getDay();
  return dow !== 0 && dow !== 6;
};

/**
 * The hours of `day` (`YYYY-MM-DD`) that can be booked now: the whole hour sits
 * inside one free block, falls in the opening hours and is at least an hour away.
 * Anything not proven free is not offered.
 */
export function freeHours(blocks: Block[], day: string, now: Date): number[] {
  if (!isWeekday(day)) return [];
  const free = blocks.filter((b) => b.status === 'free');
  const shut = blocks.filter((b) => b.status !== 'free');
  const out: number[] = [];
  for (let h = FIRST_HOUR; h <= LAST_HOUR; h++) {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    if (new Date(y, m - 1, d, h).getTime() < now.getTime() + NOTICE_MS) continue;
    const start = at(day, h);
    const end = at(day, h + 1);
    // Also not over a busy block: our own booking is overlaid on the free one until the next read.
    const clear = !shut.some((b) => b.start < end && b.end > start);
    if (clear && free.some((b) => b.start <= start && b.end >= end)) out.push(h);
  }
  return out;
}

/** What the room list shows for a room: how many hours are left and the next one. */
export function hourSummary(
  blocks: Block[],
  day: string,
  now: Date
): { count: number; next: number | null } {
  const hours = freeHours(blocks, day, now);
  return { count: hours.length, next: hours[0] ?? null };
}
