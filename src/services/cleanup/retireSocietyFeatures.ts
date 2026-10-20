import { IndexedDBService } from '../storage';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { EXAM_OPENING_KIND } from '../../utils/examOpeningReminders';

/**
 * Removes what follow, RSVP and the reminders left on a device (spec
 * 2026-10-08). Without it an answered event stays in the timetable as a block
 * nothing can remove (the card's toggle is gone), and 5.3.0's 2-hour reminders
 * still fire. Runs once; a failure leaves it unmarked so the next boot retries.
 * `seen_deadline_alerts`, `read_notifications` and `notifications_cache` are
 * Novinky's and stay (an old cache is filtered where it is read:
 * `dropPreAudienceRows`, which unlike this runs before the first frame).
 */
const DONE_KEY = 'retired_society_features_v1';
const RSVP_BLOCK_PREFIX = 'rsvp:';
const RETIRED_META_KEYS = [
  'event_rsvps_mine',
  'reis_subscribed_associations',
  'reis_associations_chosen',
  'reis_erasmus_auto_subscribed',
  'reis_muted_associations',
  'reis_notify_prefs',
  'reis_notify_asked',
];
const RETIRED_CHANNELS = ['reis-event-reminders', 'reis-society-digest'];

/**
 * What 5.3.0 left pending: everything but an exam-opening reminder. Those are
 * current (spec 2026-10-20), and a phone updating straight to a build that
 * schedules them runs this cleanup after they exist.
 */
export function retiredPending<T extends { id: number; extra?: { kind?: unknown } }>(
  pending: readonly T[]
): T[] {
  return pending.filter((n) => n.extra?.kind !== EXAM_OPENING_KIND);
}

/** 5.3.0 scheduled reminders and created two Android channels; both go. */
async function clearScheduledNotifications(): Promise<void> {
  if (getPlatform().kind !== 'capacitor') return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { notifications } = await LocalNotifications.getPending();
  const retired = retiredPending(notifications);
  if (retired.length > 0) {
    await LocalNotifications.cancel({ notifications: retired.map((n) => ({ id: n.id })) });
  }
  // Reminders 5.3.0 already delivered would sit in the tray with no tap handler.
  // Runs once, before any exam reminder could have fired, so it clears only 5.3.0's.
  await LocalNotifications.removeAllDeliveredNotifications();
  // iOS has no channel concept; the plugin call would reject there.
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.getPlatform() !== 'android') return;
  for (const id of RETIRED_CHANNELS) await LocalNotifications.deleteChannel({ id });
}

export async function retireSocietyFeatures(
  deps: { clearScheduledNotifications: () => Promise<void> } = { clearScheduledNotifications }
): Promise<void> {
  try {
    if (await IndexedDBService.get('meta', DONE_KEY)) return;
    const blocks = await IndexedDBService.getAllWithKeys('custom_events');
    for (const { key } of blocks) {
      if (String(key).startsWith(RSVP_BLOCK_PREFIX)) {
        await IndexedDBService.delete('custom_events', String(key));
      }
    }
    for (const key of RETIRED_META_KEYS) await IndexedDBService.delete('meta', key);
    await deps.clearScheduledNotifications();
    await IndexedDBService.set('meta', DONE_KEY, true);
  } catch (err) {
    logError('Cleanup.retireSocietyFeatures', err);
  }
}
