import { LocalNotifications } from '@capacitor/local-notifications';
import { useAppStore } from '../store/useAppStore';

/**
 * What tapping an event reminder does: open that event on the map, the same
 * EventDetailCard a pin or a Novinky row opens.
 *
 * `capacitorReminderDeps().schedule` has always put `extra: { eventId }` on the
 * notification for exactly this, and nothing read it back — so a tap only
 * opened the app, wherever it last was.
 *
 * Deliberately NOT `useOpenNotification`: that is a hook (this runs outside
 * React), and it counts a Novinky click. A reminder is not a Novinky click, and
 * reIS sends only what `docs/privacy-policy-app.md` lists — so this opens the
 * event and reports nothing.
 *
 * Capacitor only. The extension posts no local notifications, so there is no
 * tap to handle there — see `src/test/guards/reminderTapIsPhoneOnly.test.ts`.
 */

/** Bumped per tap, so a tap still waiting on the feed yields to a later one. */
let activation = 0;

export async function openRemindedEvent(eventId: unknown): Promise<void> {
  // `extra` comes back from the OS, and a notification from an older build (or
  // one whose payload the platform dropped) has none.
  if (typeof eventId !== 'string' || !eventId) return;
  const mine = (activation += 1);

  // The cold start: the tap launched the app, and this runs before the boot
  // load of the map feed has landed. `mapEventsLoaded` flips only on success,
  // so waiting on it rather than reading the store now is the difference
  // between opening the event and the dead tap this exists to fix. A second
  // fetch racing the boot one is harmless: the map matches the selection to a
  // pin by id, not by object.
  if (!useAppStore.getState().mapEventsLoaded) await useAppStore.getState().loadMapEvents();
  if (activation !== mine) return;

  const s = useAppStore.getState();
  // Ended since the reminder was posted, or a failed load: switching to a map
  // with nothing selected would not be opening the event, so stay put.
  if (!s.mapEvents.some((e) => e.id === eventId)) return;
  s.focusEventById(eventId, { fly: true });
  s.setMobileTab('map');
}

/**
 * Registered from `startApp` once the root has mounted. The plugin holds a tap
 * that launched the app until a listener attaches (`retainUntilConsumed` on
 * iOS, the retained `notifyListeners` on Android), so registering after the
 * mount still receives it — and registering after it means nothing the boot
 * does afterwards can reset the tab out from under it.
 */
export function installReminderTapHandler(): void {
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) =>
    openRemindedEvent((action.notification.extra as { eventId?: unknown } | undefined)?.eventId)
  );
}
