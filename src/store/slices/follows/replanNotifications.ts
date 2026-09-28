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
  // Nor from unread notification settings. A failed read leaves memory at the
  // defaults — no mutes, every switch on — and a plan built from those would
  // ring for societies the student muted and kinds they switched off. What is
  // already pending was planned from their real settings, so leaving it
  // alone is the safe side: missing one new RSVP ping in a session where the
  // read keeps failing is better than ringing for a switch they turned off.
  // `loadFollows` replans once a read commits, so the first good read lifts it.
  if (!s.notifySettingsRead) return;
  const labels = digestLabels(s.language);
  const shortName = (id: string) => s.societies[id]?.shortName ?? id;
  const plan = planNotifications(
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
  );
  // Both digest switches off is an explicit opt-out, and the plan already has
  // no digests: reconcile normally so the pending ones are cancelled.
  const wantsDigests = s.notifyPrefs.followedEvents || s.notifyPrefs.newEvents;
  if (s.followsResolved || !wantsDigests) {
    void syncReminders(plan);
    return;
  }
  // `followsLoaded` settles even when the list could not be resolved (the boot
  // race, a failed read), and `followed` is then `[]` rather than the
  // student's answer. Reconciling digests from that would cancel every pending
  // one until the retry lands; skipping the whole replan would leave RSVP
  // pings unreconciled for a student whose list never resolves. So: the pings
  // only, and the pending digests kept as they are.
  void syncReminders(
    plan.filter((n) => n.kind === 'rsvp'),
    undefined,
    { keepDigests: true }
  );
}
