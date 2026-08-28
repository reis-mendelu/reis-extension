import type { AppSlice } from '../types';
import { fetchEventRsvps, setEventRsvp, type RsvpStatus } from '../../api/eventRsvp';
import { planReminders } from '../../services/eventReminders/plan';
import { syncReminders } from '../../services/eventReminders/sync';
import { translate } from '../../i18n/translate';

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
  /** Load counts and the student's own answers for a set of events. */
  loadRsvps: (eventIds: string[]) => Promise<void>;
  /** Toggle an RSVP: tapping the active status clears it, otherwise it switches. */
  setRsvp: (eventId: string, status: RsvpStatus) => Promise<void>;
}

const EMPTY: RsvpCounts = { going: 0, interested: 0 };

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
      const { counts, mine } = await fetchEventRsvps(eventIds, get().studentId ?? null);
      set((s) => ({
        rsvpCounts: { ...s.rsvpCounts, ...counts },
        rsvp: { ...s.rsvp, ...mine },
      }));
      // Reopening the app restores the student's answers from Supabase, so their
      // reminders have to come back with them — a reinstalled app has nothing
      // pending on the device.
      refreshReminders();
    },

    setRsvp: async (eventId, status) => {
      const previous = get().rsvp[eventId];
      // Tapping the active choice un-RSVPs — the same gesture the buttons have
      // always had, now expressed to the backend as a null status.
      const next = previous === status ? undefined : status;
      const beforeCounts = get().rsvpCounts[eventId] ?? EMPTY;
      const beforeRsvp = get().rsvp;

      const optimisticRsvp = { ...beforeRsvp };
      if (next) optimisticRsvp[eventId] = next;
      else delete optimisticRsvp[eventId];

      set((s) => ({
        rsvp: optimisticRsvp,
        rsvpCounts: { ...s.rsvpCounts, [eventId]: applyAnswer(beforeCounts, previous, next) },
      }));

      const ok = await setEventRsvp(eventId, get().studentId ?? null, next ?? null);
      if (ok) {
        refreshReminders();
        return;
      }
      // Put back exactly what was there — including a previous answer, not merely
      // the absence of one.
      set((s) => ({
        rsvp: beforeRsvp,
        rsvpCounts: { ...s.rsvpCounts, [eventId]: beforeCounts },
      }));
      // The rollback is a change to the answers too: a reminder must never
      // outlive an RSVP that did not actually land.
      refreshReminders();
    },
  };
};
