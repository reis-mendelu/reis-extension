import { parseEventDate } from './eventHelpers';

// Horizons: map pins use SOON_WINDOW_DAYS (14), Novinky uses NOVINKY_WINDOW_DAYS
// (7), and the catalog list has no upper bound.

function startOfDay(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days from local midnight-today to the event date (negative = past).
export function daysUntilEvent(iso: string, now: Date = new Date()): number {
  return Math.round((parseEventDate(iso).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

export function isPastEvent(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) < 0;
}

/**
 * Whether an event that is still in the public window has already happened.
 *
 * Reported as "akce spolku se nearchivují s datem, jakmile proběhlo": an event
 * dated TODAY sits in the console's Live bucket until midnight, so checking the
 * same evening showed a finished event as current.
 *
 * The buckets are NOT the place to fix that. `isPastEvent` drives the public
 * window too, so archiving at the start time would drop the event off the
 * student map at 19:01 while people are still arriving — the event has to stay
 * visible for its whole day, and "Live" in the console means exactly that. This
 * is a marker for the row instead, so the author can see it is over without the
 * students losing it.
 *
 * Same-day only, and only with a time to compare: without one there is nothing
 * to test, and assuming a start would mark an all-day event as over at
 * midnight. Earlier days are excluded because the Proběhlé bucket already says
 * it for them.
 *
 * Single-day only, too: a multi-day event's time is when its FIRST day starts,
 * so a trip leaving at 07:30 would read as over from 07:31 on day 1. With no
 * end time there is nothing to compare, so a running one claims nothing.
 */
export function hasFinished(
  event: { date: string; endDate?: string | null; time: string | null },
  now: Date = new Date()
): boolean {
  if (!event.time) return false;
  if (event.endDate && event.endDate !== event.date) return false;
  if (daysUntilEvent(event.date, now) !== 0) return false;
  // Both halves, in range, or nothing. `Number.isFinite(h)` alone let a
  // half-parsed clock through and `(m) || 0` finished the job: '19:bad' became
  // 19:00 and marked the event over from seven in the evening, ':' became
  // midnight, and '-1:00' rolled back into the previous day so anything today
  // was already finished. It also discarded a legitimate minute, reporting a
  // 19:30 event as over at 19:15. IS supplies these strings and the console
  // lets a society type one, so "unreadable" has to claim nothing rather than
  // round down. Raised in review on this PR.
  // Matched whole, because splitting on ':' and calling Number leaves holes:
  // Number('') is 0, so ':' parsed as midnight, and a leading '-' survives
  // isInteger, so '-1:00' rolled into the previous day. The pattern rejects
  // both, along with '19', '19:30:45' and '1a:30'; the range check then covers
  // '24:00' and '19:60'.
  const clock = /^(\d{1,2}):(\d{1,2})$/.exec(event.time);
  if (!clock) return false;
  const h = Number(clock[1]);
  const m = Number(clock[2]);
  if (h > 23 || m > 59) return false;
  const start = startOfDay(now);
  start.setHours(h, m, 0, 0);
  return now.getTime() > start.getTime();
}

// The "soon" horizon: map pins show events starting within it (today ..
// today+13). Novinky has its own, shorter NOVINKY_WINDOW_DAYS below. The
// catalog list (MapEventsSection) has no upper bound — a semester imported in
// September is visible in September.
export const SOON_WINDOW_DAYS = 14;

/** Novinky lists the next week only: taps cluster in the week before an event
 *  (production, Oct 2026), and further-out rows drew impressions and no taps. */
export const NOVINKY_WINDOW_DAYS = 7;

/** Local calendar day as YYYY-MM-DD — never toISOString(), which is UTC. */
export function localTodayIso(now: Date = new Date()): string {
  const d = startOfDay(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Dated = { date: string; endDate: string | null };

/** Over once its LAST day has passed — a five-day trip stays up all five days. */
export function isFinishedEvent(e: Dated, now: Date = new Date()): boolean {
  return daysUntilEvent(e.endDate ?? e.date, now) < 0;
}

/** Still on, and starting inside the soon horizon (a running trip counts). */
export function isSoonEvent(e: Dated, now: Date = new Date()): boolean {
  return !isFinishedEvent(e, now) && daysUntilEvent(e.date, now) < SOON_WINDOW_DAYS;
}

/** Starts on day 14 or later — outside the map pins' horizon. */
export function isBeyondSoon(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) >= SOON_WINDOW_DAYS;
}
