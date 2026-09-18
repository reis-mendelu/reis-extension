import type { MapEvent } from '../../types/events';
import type { CalendarCustomEvent } from '../../types/calendarTypes';
import type { RsvpStatus } from '../../api/eventRsvp';
import { planRsvpBlocks, isRsvpBlock } from '../../utils/rsvpBlocks';
import { logError } from '../../utils/reportError';

/** The slices this reconciliation reads and writes, and nothing else. */
export interface RsvpBlockSyncState {
  mapEvents: MapEvent[];
  rsvp: Record<string, RsvpStatus>;
  customEvents: CalendarCustomEvent[];
  addCalendarCustomEvent: (event: CalendarCustomEvent) => Promise<void>;
  updateCalendarCustomEvent: (id: string, patch: Partial<CalendarCustomEvent>) => Promise<void>;
  removeCalendarCustomEvent: (id: string) => Promise<void>;
}

/**
 * Keeps the calendar's RSVP blocks equal to the student's current answers.
 *
 * Lives beside the RSVP slice rather than in it: the slice is long enough
 * already, and this is a self-contained rule — everything it touches is in
 * `RsvpBlockSyncState` and every block it may delete carries the `rsvp:` prefix,
 * so a block a student typed in themselves is never a candidate.
 *
 * SERIALISED, and that is the whole reason this is a factory rather than a
 * plain function. Each answer used to start its own detached run; two of them
 * interleaving at an `await` let an older plan add back a block a newer plan had
 * just removed, and the calendar kept an event the student had withdrawn from.
 * Raised in review. The queue is the same shape `persistAnswers` uses for the
 * same reason, and each run reads the state fresh when its turn comes, so the
 * last answer always wins.
 */
export function createRsvpBlockSync(get: () => RsvpBlockSyncState): () => void {
  let queue: Promise<void> = Promise.resolve();

  return () => {
    queue = queue.then(async () => {
      try {
        // Read at the front of our turn, never before it: a plan built while
        // waiting is a plan from before whatever ran in front of us.
        const state = get();
        const wanted = new Map(planRsvpBlocks(state.mapEvents, state.rsvp).map((b) => [b.id, b]));

        for (const existing of state.customEvents.filter((e) => isRsvpBlock(e.id))) {
          const next = wanted.get(existing.id);
          if (!next) {
            await state.removeCalendarCustomEvent(existing.id);
          } else if (
            next.title !== existing.title ||
            next.date !== existing.date ||
            next.startTime !== existing.startTime ||
            next.endTime !== existing.endTime ||
            next.room !== existing.room
          ) {
            // A society can move its event after a student has answered.
            await state.updateCalendarCustomEvent(existing.id, next);
          }
          wanted.delete(existing.id);
        }

        for (const block of wanted.values()) {
          await get().addCalendarCustomEvent(block);
        }
      } catch (err) {
        // Detached from the RSVP itself: a calendar write must not be able to
        // fail the answer the student just gave.
        logError('RsvpSlice.refreshRsvpBlocks', err);
      }
    });
  };
}
