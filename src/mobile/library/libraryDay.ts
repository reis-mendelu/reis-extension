import { getCzechHoliday } from '../../utils/holidays';
import { FIRST_HOUR, LAST_HOUR, NOTICE_MS, hourStartMs, isWeekday } from './slots';

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOf = (day: string, hour = 0): Date => {
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

/**
 * The public holiday on a weekday, by name, or null. The library is closed then
 * and Bookings just shows every hour as unavailable; the card says why instead
 * of a day of crossed-out hours (Dominik, 2026-11-16, on 17 November).
 */
export function holidayOf(day: string, lang: 'cz' | 'en'): string | null {
  return isWeekday(day) ? getCzechHoliday(dateOf(day), lang) : null;
}

const openDay = (day: string) => isWeekday(day) && !holidayOf(day, 'cz');

/** Whether the clock still leaves an hour of `day` to book (opening hours and notice). */
const stillBookable = (day: string, now: Date): boolean =>
  openDay(day) && hourStartMs(day, LAST_HOUR) >= now.getTime() + NOTICE_MS;

/**
 * The day the card opens on: today while today can still be booked, otherwise
 * the next day the library is open (no weekend, no public holiday). After
 * 19:00 every room used to read "dnes plno", which was true and useless.
 */
export function shownDay(now: Date): string {
  let day = isoDay(now);
  if (stillBookable(day, now)) return day;
  do day = nextDay(day);
  while (!openDay(day));
  return day;
}

/** Five weekdays from `from`, holidays included (they say why they are closed). */
export function weekdaysFrom(from: string, count = 5): string[] {
  const out: string[] = [];
  for (let day = from; out.length < count; day = nextDay(day)) if (isWeekday(day)) out.push(day);
  return out;
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

/** Whether an hour of `day` has gone (or sits inside the library's hour of notice). */
export const hourGone = (day: string, hour: number, now: Date): boolean =>
  hourStartMs(day, hour) < now.getTime() + NOTICE_MS;
