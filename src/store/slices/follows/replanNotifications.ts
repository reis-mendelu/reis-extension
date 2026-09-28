import type { AppState } from '../../types';
import { planNotifications } from '../../../services/eventReminders/plan';
import { digestLabels } from '../../../services/eventReminders/digestText';
import { syncReminders } from '../../../services/eventReminders/sync';

/**
 * Recomputes every RSVP ping and evening digest from the current store and
 * hands the result to `syncReminders`, which reconciles it against whatever
 * the device already has pending.
 *
 * Takes `get` rather than reading `useAppStore` directly: this lives under
 * `store/slices/follows/`, and a static import of the store here would be the
 * same require cycle Task 1 hit (`useAppStore -> createFollowSlice -> this
 * file -> useAppStore`). Every mutating follow/mute/pref/RSVP/events action
 * calls `get().replanNotifications()` — the slice wrapper this feeds — after
 * it settles, so this is the one place the plan is actually rebuilt.
 */
export function replanNotifications(get: () => AppState): void {
  const s = get();
  // Never reconcile from an unread state: `followed`/`muted`/`mapEvents`/`rsvp`
  // are all still at their cold-boot defaults until each of these three loads
  // resolves, and an empty plan built from those would cancel every
  // notification already pending on the device. `loadFollows()` (two IDB
  // reads) usually settles well before `reloadMapEvents`'s network fetch, so
  // `followsLoaded` alone is not a safe gate — its own `replanNotifications()`
  // call would otherwise fire mid-boot with `mapEvents: []` and `rsvp: {}`.
  // Each flag's owner calls `replanNotifications()` again once it settles
  // (`loadFollows`, `reloadMapEvents`, `loadRsvps`), so the first call that
  // finds all three true is the one that actually reconciles.
  if (!s.followsLoaded || !s.mapEventsLoaded || !s.rsvpLoaded) return;
  const labels = digestLabels(s.language);
  const shortName = (id: string) => s.societies[id]?.shortName ?? id;
  void syncReminders(
    planNotifications(
      {
        events: s.mapEvents,
        rsvp: s.rsvp,
        followed: s.followed,
        muted: s.muted,
        prefs: s.notifyPrefs,
        shortName,
      },
      Date.now(),
      labels
    )
  );
}
