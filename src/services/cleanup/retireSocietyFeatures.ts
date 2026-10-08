import { IndexedDBService } from '../storage';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';

/**
 * Removes what follow, RSVP and the reminders left on a device (spec
 * 2026-10-08). Without it an answered event stays in the timetable as a block
 * nothing can remove (the card's toggle is gone), and 5.3.0's 2-hour reminders
 * still fire. Runs once; a failure leaves it unmarked so the next boot retries.
 * `seen_deadline_alerts` and `read_notifications` are Novinky's and stay.
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
  // Old builds cached the unfiltered 14-day feed with no `subscribersOnly`,
  // which would read as public and show ESN's restricted rows to everyone
  // until the first fetch lands (or all session, offline).
  'notifications_cache',
];
const RETIRED_CHANNELS = ['reis-event-reminders', 'reis-society-digest'];

/** 5.3.0 scheduled reminders and created two Android channels; both go. */
async function clearScheduledNotifications(): Promise<void> {
  if (getPlatform().kind !== 'capacitor') return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
  }
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
