import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { getInstallId } from '../services/identity/installId';

export type RsvpStatus = 'going' | 'interested';
export interface RsvpCounts {
  going: number;
  interested: number;
}

export interface RsvpLoad {
  counts: Record<string, RsvpCounts>;
  /** False when the request failed, so callers can tell "nobody" from "unknown". */
  ok: boolean;
}

const RowSchema = z.object({
  event_id: z.string(),
  going_count: z.number(),
  interested_count: z.number(),
});

/**
 * Attendance counts for a set of events.
 *
 * Takes no identity at all. The student's own answer is kept on the device
 * (see createRsvpSlice), because a per-identity read would be a lookup oracle
 * and the device already knows the answer.
 *
 * Never throws, but DOES report success: a failed load must not be mistaken for
 * "this student answered nothing", or the reminder planner would cancel
 * notifications for events they are still going to.
 */
export async function fetchEventRsvps(eventIds: string[]): Promise<RsvpLoad> {
  const counts: Record<string, RsvpCounts> = {};
  if (eventIds.length === 0) return { counts, ok: true };
  for (const id of eventIds) counts[id] = { going: 0, interested: 0 };

  try {
    const { data, error } = await supabase.rpc('get_event_rsvps', { p_event_ids: eventIds });
    if (error) {
      logError('Api.fetchEventRsvps', new Error(error.message));
      return { counts, ok: false };
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
    }
    return { counts, ok: true };
  } catch (err) {
    logError('Api.fetchEventRsvps', err);
    return { counts, ok: false };
  }
}

/**
 * Record, change, or clear this install's answer. `status: null` clears it.
 *
 * The install id is a random UUID with no relationship to the student — it
 * exists only so the row can be updated and withdrawn by the device that made
 * it. Returns whether the write landed, so an optimistic update can be rolled
 * back rather than leaving a count that exists only on this device.
 */
export async function setEventRsvp(eventId: string, status: RsvpStatus | null): Promise<boolean> {
  if (isDemoMode()) return false;
  try {
    const { error } = await supabase.rpc('set_event_rsvp', {
      p_event_id: eventId,
      p_install_id: await getInstallId(),
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
