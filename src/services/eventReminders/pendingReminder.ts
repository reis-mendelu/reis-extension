import type { PendingLocalNotificationSchema } from '@capacitor/local-notifications';
import type { PendingReminder } from './sync';

/**
 * One notification from the plugin's `getPending()`, as reconcile compares it.
 * Out of `sync.ts` to keep that file from growing further.
 *
 * `kind` and `legacy` both come from the `extra` the schedule wrote. A current
 * build always writes a kind; the build before Android channels wrote only
 * `{ eventId }`, so a missing kind is `legacy` — a ping on Android's default
 * channel — rather than being folded into `'rsvp'`.
 */
export function toPendingReminder(n: PendingLocalNotificationSchema): PendingReminder {
  const kind = (n.extra as { kind?: unknown } | undefined)?.kind;
  return {
    id: n.id,
    at: n.schedule?.at ? new Date(n.schedule.at).getTime() : 0,
    // Normalised: a digest with nothing new has body '', and a bridge that
    // drops an empty string must not make it mismatch forever.
    title: n.title ?? '',
    body: n.body ?? '',
    kind: kind === 'digest' ? 'digest' : 'rsvp',
    legacy: kind === undefined,
  };
}
