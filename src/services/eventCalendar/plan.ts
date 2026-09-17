import type { MapEvent } from '../../types/events';
import type { RsvpStatus } from '../../api/eventRsvp';
import type { CalendarCustomEvent } from '../../types/calendarTypes';
import { eventStartsAt } from '../eventReminders/plan';

/**
 * How long a society event occupies the calendar.
 *
 * Ninety minutes is a placeholder, not a claim: `spolky_events` records when
 * something starts and never when it ends, so the alternative is either an
 * all-day smear or nothing at all. It is long enough to read as "this evening
 * is taken" and short enough that a student who is wrong about it loses an
 * hour and a half of apparent free time, not a day.
 */
export const BLOCK_MINUTES = 90;

/** Last minute a `CalendarCustomEvent` can name: it carries one date. */
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;

/**
 * Blocks this feature owns are named, not guessed at.
 *
 * A student's hand-made events get `crypto.randomUUID()`; these get a
 * deterministic id derived from the event, for the same reason `reminderId`
 * is deterministic — re-answering must REPLACE a block rather than add a
 * second one, and un-answering must be able to find the block to delete. The
 * prefix is also how reconciliation tells its own rows from a student's, so it
 * can never delete an event someone typed in by hand.
 */
export const RSVP_BLOCK_PREFIX = 'rsvp:';

export function blockIdFor(eventId: string): string {
  return `${RSVP_BLOCK_PREFIX}${eventId}`;
}

export function isRsvpBlock(id: string): boolean {
  return id.startsWith(RSVP_BLOCK_PREFIX);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function hhmm(minutesOfDay: number): string {
  return `${pad(Math.floor(minutesOfDay / 60))}:${pad(minutesOfDay % 60)}`;
}

/** A local Date -> the compact `YYYYMMDD` the calendar stores. */
function compactDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/**
 * The calendar block for one event, or null when it cannot be placed.
 *
 * The date and time come through `eventStartsAt` rather than a second parser:
 * it already accepts both `19:30` and the dotted `19.30` that turns up in
 * scraped rows, and already rejects `25:70` and `2026-02-30` — a date the
 * `Date` constructor would otherwise roll silently into March. Its `null` for
 * an entry with no usable time is exactly this function's "skip" signal; the
 * reminder planner reads it the same way.
 *
 * Two shapes return null:
 *   - no parseable date/time at all (an all-day entry has no 90 minutes to take)
 *   - a start so late that the block cannot exist on its own day. A
 *     `CalendarCustomEvent` has ONE date field, so 23:00 + 90min has nowhere to
 *     put the 00:30. It is clamped to 23:59 instead of wrapping, because an
 *     endTime before its startTime renders as a negative-height block; only a
 *     start at 23:59 itself, where the clamp leaves nothing at all, is dropped.
 */
export function blockForEvent(event: MapEvent): CalendarCustomEvent | null {
  const startsAt = eventStartsAt(event);
  if (startsAt === null) return null;

  const start = new Date(startsAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = Math.min(startMinutes + BLOCK_MINUTES, LAST_MINUTE_OF_DAY);
  if (endMinutes <= startMinutes) return null;

  return {
    id: blockIdFor(event.id),
    title: event.title,
    date: compactDate(start),
    startTime: hhmm(startMinutes),
    endTime: hhmm(endMinutes),
    ...(event.location ? { room: event.location } : {}),
  };
}

/**
 * Every block that should exist right now, given the events on the map and the
 * student's own answers.
 *
 * Pure and total, and derived rather than accumulated — the same shape as
 * `planReminders`, for the same reason. An RSVP write can be superseded,
 * refused and rolled back, so "add a block when tapped" would leave a block
 * behind for an answer the server never accepted. Recomputing the whole set
 * means a withdrawal simply stops being in the plan.
 */
export function planEventBlocks(
  events: MapEvent[],
  answered: Record<string, RsvpStatus>
): CalendarCustomEvent[] {
  const out: CalendarCustomEvent[] = [];
  for (const event of events) {
    if (!answered[event.id]) continue;
    const block = blockForEvent(event);
    if (block) out.push(block);
  }
  return out;
}

export interface BlockDiff {
  add: CalendarCustomEvent[];
  update: CalendarCustomEvent[];
  /** Ids to delete. */
  remove: string[];
}

function sameBlock(a: CalendarCustomEvent, b: CalendarCustomEvent): boolean {
  return (
    a.title === b.title &&
    a.date === b.date &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime &&
    (a.room ?? '') === (b.room ?? '')
  );
}

/**
 * What has to change to turn the blocks currently stored into the planned set.
 *
 * `existing` must already be narrowed to this feature's own rows (see
 * `isRsvpBlock`) — everything it is handed and cannot find in the plan is
 * deleted, and a student's hand-made events must never reach that.
 *
 * Unchanged blocks are left alone rather than rewritten, so a reconcile that
 * changes nothing costs no IndexedDB writes and no store churn — this runs
 * after every settled RSVP and on every load.
 */
export function diffEventBlocks(
  existing: CalendarCustomEvent[],
  desired: CalendarCustomEvent[]
): BlockDiff {
  const byId = new Map(existing.map((b) => [b.id, b]));
  const wanted = new Set(desired.map((b) => b.id));

  const add: CalendarCustomEvent[] = [];
  const update: CalendarCustomEvent[] = [];
  for (const block of desired) {
    const current = byId.get(block.id);
    if (!current) add.push(block);
    else if (!sameBlock(current, block)) update.push(block);
  }

  const remove = existing.filter((b) => !wanted.has(b.id)).map((b) => b.id);
  return { add, update, remove };
}
