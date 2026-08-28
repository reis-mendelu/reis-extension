import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';

export type RsvpStatus = 'going' | 'interested';
export interface RsvpCounts {
  going: number;
  interested: number;
}
export interface EventRsvpSnapshot {
  counts: Record<string, RsvpCounts>;
  /** The caller's own answer per event; absent when they have not responded. */
  mine: Record<string, RsvpStatus>;
}

// The RPC groups by event, so an event nobody has answered is simply missing
// from the result rather than present as a row of zeroes.
const RowSchema = z.object({
  event_id: z.string(),
  going_count: z.number(),
  interested_count: z.number(),
  my_status: z.enum(['going', 'interested']).nullable(),
});

/**
 * Opaque per-student key for the attendance tables.
 *
 * The same construction feedback_responses and daily_active_usage use: the raw
 * IS id is a real student number and never leaves the device. The table's own
 * CHECK constraint rejects anything that is not a 64-char digest, so a caller
 * that forgets this is refused by Postgres rather than quietly storing one.
 */
export async function hashStudentId(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Counts for a set of events plus the caller's own answer, in one round trip.
 *
 * Never throws: a card that cannot reach Supabase shows 0 / 0, which is honest
 * about what is known. It is the mock this replaces — deterministic fake counts
 * hashed out of the event id — that was not.
 */
export async function fetchEventRsvps(
  eventIds: string[],
  studentId: string | null
): Promise<EventRsvpSnapshot> {
  const counts: Record<string, RsvpCounts> = {};
  const mine: Record<string, RsvpStatus> = {};
  if (eventIds.length === 0) return { counts, mine };

  // Zero is the floor for every event asked about, so a caller never reads
  // `undefined` off an event the RPC had nothing to say about.
  for (const id of eventIds) counts[id] = { going: 0, interested: 0 };

  try {
    const { data, error } = await supabase.rpc('get_event_rsvps', {
      p_event_ids: eventIds,
      p_student_id: studentId ? await hashStudentId(studentId) : null,
    });
    if (error) {
      logError('Api.fetchEventRsvps', new Error(error.message));
      return { counts, mine };
    }
    for (const row of (data ?? []) as unknown[]) {
      const parsed = RowSchema.safeParse(row);
      // A malformed row is dropped rather than coerced: NaN on a card is worse
      // than a zero, and worse than the honest absence of a number.
      if (!parsed.success) continue;
      counts[parsed.data.event_id] = {
        going: parsed.data.going_count,
        interested: parsed.data.interested_count,
      };
      if (parsed.data.my_status) mine[parsed.data.event_id] = parsed.data.my_status;
    }
  } catch (err) {
    logError('Api.fetchEventRsvps', err);
  }
  return { counts, mine };
}

/**
 * Record, change, or clear the student's own RSVP. `status: null` clears it —
 * tapping the active choice again is an un-RSVP, not a second row.
 *
 * Returns whether the write landed, so the caller can roll its optimistic
 * update back rather than leaving a count that only exists on this device.
 */
export async function setEventRsvp(
  eventId: string,
  studentId: string | null,
  status: RsvpStatus | null
): Promise<boolean> {
  // The demo student is invented; its hash would be fictional attendance inside
  // the real counts every other student reads.
  if (isDemoMode() || !studentId) return false;
  try {
    const { error } = await supabase.rpc('set_event_rsvp', {
      p_event_id: eventId,
      p_student_id: await hashStudentId(studentId),
      p_status: status,
    });
    if (error) {
      logError('Api.setEventRsvp', new Error(error.message));
      return false;
    }
    return true;
  } catch (err) {
    logError('Api.setEventRsvp', err);
    return false;
  }
}
