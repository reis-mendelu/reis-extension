import { LocalNotifications } from '@capacitor/local-notifications';
import { openExamsFromNotification } from './examReminders';
import { openFromNotification } from './zaznamnikNotifications';

/**
 * The ONE listener for taps on reIS's local notifications, on iOS and Android.
 *
 * A tap that cold-starts the app arrives before any JS listener exists.
 * Capacitor retains it and hands it only to the FIRST listener registered for
 * it (Plugin.java on Android, CAPPlugin.m on iOS). With one listener per
 * feature, whichever installed first swallowed the other feature's taps. So
 * every tap goes to every feature, and each ignores kinds that are not its own.
 *
 * Installed from capacitor/startApp before either feature.
 */
export function installNotificationTaps(): void {
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    openExamsFromNotification(notification.extra);
    openFromNotification(notification.extra);
  });
}
