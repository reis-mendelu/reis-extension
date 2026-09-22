import type { MapEvent } from '../types/events';
import type { CalendarCustomEvent } from '../types/calendarTypes';
import type { RsvpStatus } from '../api/eventRsvp';
import { eventStartsAt } from '../services/eventReminders/plan';

/**
 * The calendar blocks that follow from the student's own answers.
 *
 * Saying "Mám zájem" now puts the event in the calendar, because that is what
 * answering meant all along — the card asked, the calendar was where the
 * student expected to see it, and the two were not connected.
 *
 * DERIVED, never accumulated: `refreshRsvpBlocks` reconciles the calendar
 * against whatever this returns, exactly as `planReminders` does for
 * notifications. That is what makes un-answering take the block away again —
 * it simply stops being in the plan — and it is why the ids are prefixed:
 * reconciliation must be able to tell its own blocks from the ones a student
 * typed in themselves, and may only ever delete its own.
 */
export const RSVP_BLOCK_PREFIX = 'rsvp:';

/** 1.5 hours — the length asked for, and the one an evening society event runs. */
export const RSVP_BLOCK_MINUTES = 90;

export const rsvpBlockId = (eventId: string): string => `${RSVP_BLOCK_PREFIX}${eventId}`;

export const isRsvpBlock = (id: string): boolean => id.startsWith(RSVP_BLOCK_PREFIX);

/**
 * The event a block stands for, or null when the id is not one of ours.
 *
 * The inverse of `rsvpBlockId`, and the reason the prefix is worth carrying: a
 * calendar row knows only its own id, so this is what lets the phone send a tap
 * on "ESN Welcome Party" to the event on the map rather than to a subject
 * drawer for a course code that does not exist. Null for an entry the student
 * typed in themselves — there is no event behind it to open.
 */
export const eventIdFromRsvpBlock = (id: string): string | null =>
  isRsvpBlock(id) ? id.slice(RSVP_BLOCK_PREFIX.length) : null;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function planRsvpBlocks(
  events: readonly MapEvent[],
  answered: Record<string, RsvpStatus>
): CalendarCustomEvent[] {
  const out: CalendarCustomEvent[] = [];
  for (const event of events) {
    if (!answered[event.id]) continue;
    // Reused rather than re-parsed: the same event rows feed the reminders, and
    // a second date parser is a second set of rules about dotted times and
    // "25:70". A row it refuses has no start, so it gets no block.
    const starts = eventStartsAt(event);
    if (starts === null) continue;

    const start = new Date(starts);
    const end = new Date(starts + RSVP_BLOCK_MINUTES * 60_000);
    // A 23:00 event would otherwise end at 00:30 on a date the block does not
    // carry, and the week grid would draw it at half past midnight that same
    // morning — before the thing it is for. Cut at the end of the day instead.
    const endsNextDay = ymd(end) !== ymd(start);

    out.push({
      id: rsvpBlockId(event.id),
      title: event.title,
      date: ymd(start),
      startTime: hm(start),
      endTime: endsNextDay ? '23:59' : hm(end),
      room: event.location ?? undefined,
    });
  }
  return out;
}
