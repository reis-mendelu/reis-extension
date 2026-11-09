import type { Venue, VenueHours } from '../../types/campusMap';

type Day = VenueHours['day'];

export type VenueStatus =
  | { open: true; closes: string }
  /**
   * When it next opens: the time, the ISO weekday, the Prague date and how many
   * days from today (0 = later today). All null when it never does.
   */
  | {
      open: false;
      opens: string | null;
      day: Day | null;
      date: string | null;
      inDays: number | null;
    };

/** Weekday (1 = Monday), 'YYYY-MM-DD' and 'HH:MM' in Prague, whatever the device's zone. */
export function pragueClock(now: Date): { day: Day; date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Prague',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const day = (days.indexOf(get('weekday')) + 1) as Day;
  // en-GB writes midnight as 24 in some engines.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    day,
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
}

/** 'YYYY-MM-DD' plus `n` calendar days — date arithmetic, so no DST edge. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` ('YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

const closedOn = (closure: Venue['closure'], date: string) =>
  !!closure && date >= closure.from && date <= closure.until;

/**
 * Open now, and until when — or when it next opens. Hours are local Prague
 * time, as a café states them, so the answer is the same on a phone set to
 * any time zone. A dated closure (`venues.closed_from/closed_until`) wins over
 * the hours; public holidays are not modelled.
 */
export function venueStatus(
  hours: VenueHours[],
  now: Date,
  closure: Venue['closure'] = null
): VenueStatus {
  const { day, date, time } = pragueClock(now);
  // Two months is past any closure a café announces; beyond that, "never".
  for (let i = 0; i <= 62; i++) {
    const d = addDays(date, i);
    if (closedOn(closure, d)) continue;
    const weekday = (((day - 1 + i) % 7) + 1) as Day;
    const h = hours.find((x) => x.day === weekday);
    if (!h) continue;
    if (i === 0 && time >= h.close) continue;
    if (i === 0 && time >= h.open) return { open: true, closes: h.close };
    return { open: false, opens: h.open, day: weekday, date: d, inDays: i };
  }
  return { open: false, opens: null, day: null, date: null, inDays: null };
}

/**
 * Whether the venue opens at all on a Prague calendar day ('YYYY-MM-DD'): it
 * has hours that weekday and no dated closure covers it.
 */
export function venueOpensOn(venue: Pick<Venue, 'hours' | 'closure'>, date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = ((new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7) + 1;
  return !closedOn(venue.closure, date) && venue.hours.some((h) => h.day === weekday);
}

/**
 * The closure worth announcing: one in progress, or one starting within a week.
 * Null once it is over, or while it is still far off.
 */
export function closureNotice(
  closure: Venue['closure'],
  now: Date
): { state: 'now' | 'soon'; from: string; until: string } | null {
  if (!closure) return null;
  const today = pragueClock(now).date;
  if (today > closure.until) return null;
  if (today >= closure.from) return { state: 'now', ...closure };
  return daysBetween(today, closure.from) <= 7 ? { state: 'soon', ...closure } : null;
}

/**
 * The week's hours, grouped: [{ from: 1, to: 5, open: '08:00', close: '18:00' }]
 * reads "Po–Pá 8:00–18:00". Consecutive days with the same times join.
 */
export function groupHours(
  hours: VenueHours[]
): { from: Day; to: Day; open: string; close: string }[] {
  const sorted = [...hours].sort((a, b) => a.day - b.day);
  const out: { from: Day; to: Day; open: string; close: string }[] = [];
  for (const h of sorted) {
    const last = out[out.length - 1];
    if (last && last.to === h.day - 1 && last.open === h.open && last.close === h.close) {
      last.to = h.day;
    } else {
      out.push({ from: h.day, to: h.day, open: h.open, close: h.close });
    }
  }
  return out;
}

/** '08:00' → '8:00'. */
export const shortTime = (time: string) => time.replace(/^0(\d)/, '$1');
