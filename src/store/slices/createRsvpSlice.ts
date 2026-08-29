import type { AppSlice } from '../types';
import { fetchEventRsvps, setEventRsvp, type RsvpStatus } from '../../api/eventRsvp';
import { IndexedDBService } from '../../services/storage';
import { planReminders } from '../../services/eventReminders/plan';
import { syncReminders } from '../../services/eventReminders/sync';
import { translate } from '../../i18n/translate';
import { logError } from '../../utils/reportError';

export type { RsvpStatus };

export interface RsvpCounts {
  going: number;
  interested: number;
}

export interface RsvpSlice {
  /** The current user's RSVP per event id. Absent = no response. */
  rsvp: Record<string, RsvpStatus>;
  /** Real attendance per event id, as reported by Supabase. */
  rsvpCounts: Record<string, RsvpCounts>;
  /** Load counts for a set of events, and this device's own answers from IDB. */
  loadRsvps: (eventIds: string[]) => Promise<void>;
  /** Toggle an RSVP: tapping the active status clears it, otherwise it switches. */
  setRsvp: (eventId: string, status: RsvpStatus) => Promise<void>;
}

const EMPTY: RsvpCounts = { going: 0, interested: 0 };
// The device is the sole record of its own answers — the server is never told
// who this is, so it cannot hand them back on a new session.
const RSVP_KEY = 'event_rsvps_mine';

/**
 * Applies one student's answer to a count, in whichever direction.
 *
 * `Math.max(0, …)` is not defensive dressing: the counts come from a shared
 * table, so another student's response can land between a load and a tap, and a
 * card must never render "-1 going".
 */
function applyAnswer(
  counts: RsvpCounts,
  previous: RsvpStatus | undefined,
  next: RsvpStatus | undefined
): RsvpCounts {
  const out = { ...counts };
  if (previous) out[previous] = Math.max(0, out[previous] - 1);
  if (next) out[next] = out[next] + 1;
  return out;
}

/**
 * The student's own Going / Interested response to society events, and the real
 * attendance behind it.
 *
 * This used to be memory-only state paired with `socialFor()`, which hashed the
 * event id into a plausible pair of numbers — so an event nobody had answered
 * advertised "108 zájemců" to every student who opened it. The numbers here now
 * come from the `event_rsvps` table via SECURITY DEFINER RPCs.
 *
 * Writes are optimistic and rolled back on failure. That matters more than the
 * usual snappiness argument: a count that only ever existed on one device would
 * be the same fabrication the mock was, just harder to notice.
 */
export const createRsvpSlice: AppSlice<RsvpSlice> = (set, get) => {
  /**
   * Per-event mutation counter. Tapping bumps it; a request that finishes when
   * it is no longer the latest for its event must not touch state.
   *
   * Without it, tap Going then Interested on one card and let the FIRST request
   * fail after the second succeeded: the loser's rollback restores the answer
   * the student already replaced, and reminders are then rebuilt from it.
   */
  const revisions = new Map<string, number>();

  /**
   * Re-derive every reminder from the current answers, after any change to
   * them. Recomputing the whole set rather than nudging one is what makes
   * un-RSVPing cancel its notification: the reminder simply stops being in the
   * plan, and syncReminders cancels whatever the device is holding that the
   * plan no longer contains.
   *
   * Detached from its caller: a notification is a courtesy and must not be able
   * to fail an RSVP.
   */
  const refreshReminders = () => {
    // `translate` rather than useTranslation: this runs in the store, outside
    // any component, which is exactly what that helper exists for.
    const lead = translate(get().language, 'map.reminderLead');
    void syncReminders(planReminders(get().mapEvents, get().rsvp, Date.now(), lead));
  };

  return {
    rsvp: {},
    rsvpCounts: {},

    loadRsvps: async (eventIds) => {
      if (eventIds.length === 0) return;
      // Own answers come from the device, not the server: the server is never
      // told who this is, so it could not return them even if we asked.
      // Caught separately: a storage failure must not take the counts down with
      // it. The cards can render real attendance without knowing this device's
      // own answer — the reverse is the useless half.
      let stored: Record<string, RsvpStatus> | null = null;
      try {
        stored = ((await IndexedDBService.get('meta', RSVP_KEY)) ?? {}) as Record<
          string,
          RsvpStatus
        >;
      } catch (err) {
        logError('RsvpSlice.loadRsvps', err);
      }
      const { counts, ok } = await fetchEventRsvps(eventIds);
      set((s) => ({
        // A failed load returns zeroes; writing those over known counts would
        // replace real numbers with a confident-looking lie.
        rsvpCounts: ok ? { ...s.rsvpCounts, ...counts } : s.rsvpCounts,
        rsvp: { ...(stored ?? {}), ...s.rsvp },
      }));
      // Only reconcile once the answers are actually known — from BOTH sides.
      // Reconciling from a failed load means an empty plan, and syncReminders
      // cancels everything not in the plan, silently wiping reminders for
      // events still attended. An unread `stored` is exactly that empty plan.
      if (ok && stored) refreshReminders();
    },

    setRsvp: async (eventId, status) => {
      const previous = get().rsvp[eventId];
      // Tapping the active choice un-RSVPs — the same gesture the buttons have
      // always had, now expressed to the backend as a null status.
      const next = previous === status ? undefined : status;
      const beforeCounts = get().rsvpCounts[eventId] ?? EMPTY;

      const revision = (revisions.get(eventId) ?? 0) + 1;
      revisions.set(eventId, revision);

      // Derived from the CURRENT map inside `set`, never from a snapshot taken
      // before the await: a snapshot silently reverts whatever landed meanwhile.
      set((s) => {
        const optimistic = { ...s.rsvp };
        if (next) optimistic[eventId] = next;
        else delete optimistic[eventId];
        return {
          rsvp: optimistic,
          rsvpCounts: { ...s.rsvpCounts, [eventId]: applyAnswer(beforeCounts, previous, next) },
        };
      });

      const ok = await setEventRsvp(eventId, next ?? null);

      // Superseded while in flight. The newer tap owns this event's outcome in
      // both directions — applying ours would resurrect a replaced answer.
      if (revisions.get(eventId) !== revision) return;

      if (ok) {
        // The device is the only record of its own answer, so persist it — from
        // the live map, so a concurrent answer to a DIFFERENT event survives.
        void IndexedDBService.set('meta', RSVP_KEY, get().rsvp);
        refreshReminders();
        return;
      }
      // Roll back ONLY this event. Restoring a whole snapshot of the answers
      // erased unrelated events that were answered while this was in flight.
      set((s) => {
        const rolledBack = { ...s.rsvp };
        if (previous) rolledBack[eventId] = previous;
        else delete rolledBack[eventId];
        return { rsvp: rolledBack, rsvpCounts: { ...s.rsvpCounts, [eventId]: beforeCounts } };
      });
      // The rollback is a change to the answers too: a reminder must never
      // outlive an RSVP that did not actually land.
      refreshReminders();
    },
  };
};
