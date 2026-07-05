import { parseEventDate } from './eventHelpers';

// How far ahead the PUBLIC map/feed shows events: this week + next week.
// Past events and anything further out are hidden from students; a society's own
// far-future events surface only in Society mode as "scheduled" pins.
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
  d.setDate(d.getDate() - (PUBLIC_WINDOW_DAYS - 2));
  return d;
}
