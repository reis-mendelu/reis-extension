import type { MapEvent } from '../../types/events';
import type { RsvpStatus } from '../../api/eventRsvp';

/**
 * How much warning a reminder gives.
 *
 * Two hours, not one: an hour's notice is not enough to cross Brno, change and
 * get to a venue, so a reminder that late is an apology rather than a use.
 */
export const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;

export interface PlannedReminder {
  /** Stable per event, so rescheduling replaces a reminder instead of adding one. */
  id: number;
  eventId: string;
  title: string;
  body: string;
  /** Epoch ms at which the notification should fire. */
  at: number;
}

/**
 * Capacitor's LocalNotifications ids are 32-bit signed integers; an event id is
 * a uuid. FNV-1a, masked into the positive 31-bit range, so the id is stable
 * across app launches (a random one would re-notify for the same event after
 * every restart) and cannot overflow into a collision that silently merges two
 * events into one reminder.
 */
export function reminderId(eventId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < eventId.length; i++) {
    h ^= eventId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 1 keeps it positive and inside 2^31 - 1; | 1 keeps it away from 0,
  // which the plugin treats as "no id".
  return ((h >>> 1) | 1) >>> 0;
}

/**
 * When an event actually starts, in local time.
 *
 * Returns null rather than a guess when there is no usable time: an all-day
 * entry has no "two hours before", and inventing one (9am? the previous
 * evening?) would fire a notification at a moment nobody chose.
 */
export function eventStartsAt(event: MapEvent): number | null {
  if (!event.time) return null;
  // IS and the composer both emit HH:MM, but dotted "19.30" turns up in
  // scraped rows, so both separators are accepted.
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(event.time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  // The regex shape allows "25:70"; the Date constructor would happily roll
  // that into the next day rather than reject it, and the student would be
  // pinged at a time no one chose.
  if (hour > 23 || minute > 59) return null;

  // The shape is checked before the parts are read: `split('-')` ignores
  // trailing fields, so "2026-09-10-extra" would yield a perfectly valid
  // 2026-09-10 and pass the round-trip check below.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return null;

  // Constructed from parts rather than parsed from a string: `new Date('...')`
  // treats a bare date as UTC and a date+time as local, which would shift
  // every reminder by the timezone offset.
  const [y, mo, d] = event.date.split('-').map(Number);
  if (!y || !mo || !d) return null;
  const start = new Date(y, mo - 1, d, hour, minute, 0, 0);
  const at = start.getTime();
  if (!Number.isFinite(at)) return null;
  // Same normalisation trap on the date half: "2026-02-30" becomes 2 March.
  // Reading the components back is the only way to tell a real date from one
  // the constructor quietly moved.
  if (start.getFullYear() !== y || start.getMonth() !== mo - 1 || start.getDate() !== d) {
    return null;
  }
  return at;
}

/**
 * The reminders that should exist right now, given the events on the map and
 * the student's own answers.
 *
 * Pure and total: it decides nothing about permissions or the plugin, so the
 * rule ("two hours before anything I said I'd go to, or was interested in") is
 * testable without a device.
 */
export function planReminders(
  events: MapEvent[],
  answered: Record<string, RsvpStatus>,
  now: number,
  /** Localised "In 2 hours" — the notification has to say what it is, not just
   *  name a room. Passed in rather than translated here so this stays pure. */
  leadLabel = ''
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const event of events) {
    // Interested counts as well as Going: both are the student asking to hear
    // about it, and only one of them is a commitment.
    if (!answered[event.id]) continue;
    const starts = eventStartsAt(event);
    if (starts === null) continue;
    const at = starts - REMINDER_LEAD_MS;
    // Already past its warning, or past altogether — a notification fired now
    // for something starting in ninety minutes is noise, not notice.
    if (at <= now) continue;
    out.push({
      id: reminderId(event.id),
      eventId: event.id,
      title: event.title,
      body: [leadLabel, event.location].filter(Boolean).join(' · '),
      at,
    });
  }
  return out;
}
