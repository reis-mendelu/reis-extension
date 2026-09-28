import type { AppState } from '../../types';
import { planNotifications, type DigestLabels } from '../../../services/eventReminders/plan';
import { syncReminders } from '../../../services/eventReminders/sync';
import { translate } from '../../../i18n/translate';

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
  // Never reconcile from an unread state: `followed`/`muted`/`rsvp` are all
  // still at their cold-boot defaults until `loadFollows()` resolves, and an
  // empty plan built from those would cancel every notification already
  // pending on the device.
  if (!s.followsLoaded) return;
  const lang = s.language;
  const tr = (k: string, p?: Record<string, string | number>) => translate(lang, k, p);
  const labels: DigestLabels = {
    tomorrow: (titles) => tr('notify.digestTomorrow', { titles }),
    tomorrowMany: (n, titles) => tr('notify.digestTomorrowMany', { n, titles }),
    newOnly: (titles) => tr('notify.digestNewOnly', { titles }),
    plusNew: (n, societies) => tr('notify.digestPlusNew', { n, societies }),
    leadLabel: tr('map.reminderLead'),
  };
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
