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
   * The last answer per event the SERVER is known to hold. Absent = no answer.
   *
   * A rollback cannot restore "whatever the map said when this tap happened":
   * taps faster than a round trip are collapsed, so the intermediate ones never
   * reached the server. Tap Going, Interested, Going quickly and let the final
   * write fail, and restoring the tap-time value leaves the card — and
   * IndexedDB — on Interested, an answer nothing ever accepted, which then
   * schedules a reminder for an event the student is not signed up to.
   *
   * Confirmed values come from two places only: what was read off the device at
   * load (which is written exclusively by settled outcomes), and a write the
   * server actually accepted.
   */
  const confirmed = new Map<string, RsvpStatus | undefined>();

  /**
   * One in-flight write per event, in tap order.
   *
   * The revision counter above keeps the CLIENT consistent, but it cannot keep
   * the SERVER consistent: two requests issued back to back can reach Postgres
   * in either order, so a Going issued first and arriving last wins the upsert
   * while the device sits on Interested. `get_event_rsvps` returns counts only —
   * by design, since a per-identity read would be a lookup oracle — so nothing
   * would ever detect the divergence.
   *
   * Chaining per event means the next write is only issued after the previous
   * one has been answered, which is what makes "last tap wins" true at the
   * server too. Per event rather than globally: answering one card must not
   * queue behind another card's request.
   */
  const inFlight = new Map<string, Promise<unknown>>();

  /**
   * Write the device's own answers to IndexedDB — only the CONFIRMED ones.
   *
   * Writing the live map was wrong in a way that outlived the session: it
   * captured any other event's still-optimistic answer, so killing the app
   * before that write settled left an unaccepted answer on disk, and the next
   * launch read it back as real and treated it as confirmed.
   *
   * Merged over what is already stored rather than replacing it, because
   * `loadRsvps` is detached and a tap can beat it: replacing wholesale would
   * drop stored answers for events this session has not loaded yet.
   */
  let persistQueue: Promise<void> = Promise.resolve();
  const persistAnswers = () => {
    // Serialised: this is a read-modify-write, and two of them interleaving
    // would let the slower one write back a map it had already gone stale on.
    persistQueue = persistQueue.then(async () => {
      try {
        const onDisk = ((await IndexedDBService.get('meta', RSVP_KEY)) ?? {}) as Record<
          string,
          RsvpStatus
        >;
        const next = { ...onDisk };
        for (const [id, answer] of confirmed) {
          if (answer) next[id] = answer;
          else delete next[id];
        }
        await IndexedDBService.set('meta', RSVP_KEY, next);
      } catch (err) {
        logError('RsvpSlice.persistAnswers', err);
      }
    });
  };

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
      // Snapshot each event's revision before any await. Everything this load
      // carries — answers AND counts — was true at this instant; a tap that
      // settles while the reads are out makes it stale for that event only, and
      // comparing revisions afterwards is how we tell which ones.
      //
      // A snapshot rather than "has this event ever been mutated": the latter
      // would make a mutated event permanently unable to receive fresh counts,
      // so other students' answers would stop appearing on that card.
      const startRevisions = new Map(eventIds.map((id) => [id, revisions.get(id) ?? 0]));
      const supersededDuringLoad = (id: string) =>
        (revisions.get(id) ?? 0) !== (startRevisions.get(id) ?? 0);
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
      // The stored map holds only confirmed answers (see persistAnswers), so it
      // is exactly the set the server has accepted — the right rollback target.
      //
      // Seeded only where this session knows nothing yet. The read above is
      // awaited and this load is detached, so a tap can settle in between: an
      // unconditional seed would then overwrite a freshly confirmed answer with
      // the disk value it superseded, and the next failed write would roll the
      // card back to it. Anything already in `confirmed` came from a settled
      // write in this session and is by definition newer than the disk.
      if (stored) {
        for (const [id, answer] of Object.entries(stored)) {
          if (!confirmed.has(id) && !supersededDuringLoad(id)) confirmed.set(id, answer);
        }
      }

      const { counts, ok } = await fetchEventRsvps(eventIds);
      set((s) => {
        // Spreading `stored` under the live map is not enough. A WITHDRAWAL that
        // settles during this load removes its event from `s.rsvp` entirely, so
        // the spread silently re-inserts the answer the student just took back —
        // and refreshReminders below then schedules a reminder for it, while
        // disk already says otherwise. `revisions` names every event this
        // session has touched, so those are left alone in both directions.
        const hydrated = { ...s.rsvp };
        for (const [id, answer] of Object.entries(stored ?? {})) {
          if (!supersededDuringLoad(id) && !(id in hydrated)) hydrated[id] = answer;
        }

        // Counts go stale the same way the answers do: a tap that lands while
        // this request was out already moved the number, and merging the older
        // response back would drop the student's own accepted answer off the
        // card until some later load happened to refresh it.
        const mergedCounts = { ...s.rsvpCounts };
        if (ok) {
          for (const [id, c] of Object.entries(counts)) {
            if (!supersededDuringLoad(id)) mergedCounts[id] = c;
          }
        }

        return {
          // A failed load returns zeroes; writing those over known counts would
          // replace real numbers with a confident-looking lie.
          rsvpCounts: ok ? mergedCounts : s.rsvpCounts,
          rsvp: hydrated,
        };
      });
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

      // Wait for this event's previous write, then send. `.catch` keeps one
      // rejected turn from wedging the chain for the rest of the session.
      const previousWrite = inFlight.get(eventId) ?? Promise.resolve();
      const thisWrite = previousWrite
        .catch(() => {})
        .then(async () => {
          // Superseded while queued: the newer tap will write the final state, so
          // sending this one only costs a round trip and a chance to land last.
          if (revisions.get(eventId) !== revision) return null;
          return setEventRsvp(eventId, next ?? null);
        });
      inFlight.set(eventId, thisWrite);

      const ok = await thisWrite;

      // Recorded BEFORE the supersede check below: the server accepted this
      // write, and that is true whether or not a newer tap has since arrived.
      // Skipping it meant a superseded-but-successful Going left `confirmed`
      // empty, so when the queued Interested then failed the card rolled back
      // to "no answer" while the server still held Going — and persisted it.
      // Writes are chained per event, so the last accepted one wins here.
      if (ok === true) confirmed.set(eventId, next);

      // Only the newest tap clears the slot, so a slower predecessor cannot
      // erase a successor's entry and let the next tap race it.
      if (revisions.get(eventId) === revision) inFlight.delete(eventId);

      // Never sent, because a newer tap had already superseded it while it
      // queued. Nothing happened, so there is nothing to record.
      if (ok === null) return;

      // Sent, and superseded while in flight. The newer tap owns what the CARD
      // shows, so no state is applied here — but the server did accept this
      // write, so disk has to say so. Skipping the persist meant that killing
      // the app before the newer write settled left storage on an older answer
      // while the server held this one, and the next launch restored the
      // disagreement along with a reminder built from it.
      if (revisions.get(eventId) !== revision) {
        if (ok) persistAnswers();
        return;
      }

      if (ok) {
        persistAnswers();
        refreshReminders();
        return;
      }
      // Roll back ONLY this event, and to the last answer the SERVER accepted —
      // not to whatever the map held when this tap happened, which after
      // collapsed taps can be a selection no request ever carried. Restoring a
      // whole snapshot also erased unrelated events answered meanwhile.
      set((s) => {
        const shown = s.rsvp[eventId];
        const settled = confirmed.get(eventId);
        const rolledBack = { ...s.rsvp };
        if (settled) rolledBack[eventId] = settled;
        else delete rolledBack[eventId];
        return {
          rsvp: rolledBack,
          // Derived from the counts as DISPLAYED, so the number moves by exactly
          // the answer being withdrawn. `beforeCounts` is a tap-time snapshot and
          // carries the same staleness the answer did.
          rsvpCounts: {
            ...s.rsvpCounts,
            [eventId]: applyAnswer(s.rsvpCounts[eventId] ?? EMPTY, shown, settled),
          },
        };
      });
      // Persist the rollback too, not just the success. Writing the live map on
      // success can capture ANOTHER event's still-unconfirmed answer; if that
      // one is then refused, undoing it only in Zustand leaves the rejected
      // answer in IndexedDB, where the next launch reads it back as real and
      // schedules a reminder for an event the student never signed up to.
      persistAnswers();
      // The rollback is a change to the answers too: a reminder must never
      // outlive an RSVP that did not actually land.
      refreshReminders();
    },
  };
};
