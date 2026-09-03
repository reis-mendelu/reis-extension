import { parseEventDate } from './eventHelpers';

// How far ahead the PUBLIC map/feed shows events: this week + next week.
// Past events and anything further out are hidden from students; a society's own
// far-future events surface only in the admin console as "scheduled" pins.
export const PUBLIC_WINDOW_DAYS = 14;

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
 */
export function hasFinished(
  event: { date: string; time: string | null },
  now: Date = new Date()
): boolean {
  if (!event.time) return false;
  if (daysUntilEvent(event.date, now) !== 0) return false;
  const [h, m] = event.time.split(':').map(Number);
  if (!Number.isFinite(h)) return false;
  const start = startOfDay(now);
  start.setHours(h as number, (m as number) || 0, 0, 0);
  return now.getTime() > start.getTime();
}

// today .. today+13 inclusive.
export function isPublicEvent(iso: string, now: Date = new Date()): boolean {
  const d = daysUntilEvent(iso, now);
  return d >= 0 && d < PUBLIC_WINDOW_DAYS;
}

// A society's own upcoming event still outside the public window.
export function isScheduledEvent(iso: string, now: Date = new Date()): boolean {
  return daysUntilEvent(iso, now) >= PUBLIC_WINDOW_DAYS;
}

// The first calendar day the event becomes public (enters the window):
// date − (PUBLIC_WINDOW_DAYS − 1) days.
export function goLiveDate(iso: string, now: Date = new Date()): Date {
  void now;
  const d = startOfDay(parseEventDate(iso));
  d.setDate(d.getDate() - (PUBLIC_WINDOW_DAYS - 1));
  return d;
}
