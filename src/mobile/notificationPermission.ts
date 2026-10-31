import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import type { SystemNotificationStatus } from '../store/slices/createSystemNotificationsSlice';
import { logError } from '../utils/reportError';
import { launchInSystemBrowser } from './openInBrowser';

/** Android-only: the app's own page in system Settings → Notifications. */
interface SettingsPlugin {
  openNotificationSettings(): Promise<void>;
}
const Downloads = registerPlugin<SettingsPlugin>('Downloads');

function toStatus(display: string): SystemNotificationStatus {
  if (display === 'granted') return 'granted';
  if (display === 'denied') return 'denied';
  // `prompt-with-rationale` is Android after one refusal: the system will still
  // show its dialog once more, so it is the same "can be asked" state.
  return 'prompt';
}

/**
 * Reads the system's answer into the store. Run at launch and on every resume,
 * because the student can switch notifications off in Settings and come back.
 * A failed read leaves the last known state: unknown is not "off".
 */
export async function refreshNotificationStatus(): Promise<SystemNotificationStatus> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    const status = toStatus(display);
    useAppStore.getState().setSystemNotifications(status);
    return status;
  } catch (err) {
    logError('Mobile.refreshNotificationStatus', err);
    return useAppStore.getState().systemNotifications;
  }
}

/**
 * Once, at the first launch after sign-in: the system dialog while it is still
 * a plain "never asked". After a refusal the state is `denied` (or the rationale
 * variant, also mapped to `prompt`, which is why only the very first answer
 * counts here), and the student is not nagged: the banner and the row stay.
 */
export async function askNotificationsIfNeverAsked(): Promise<void> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt') await LocalNotifications.requestPermissions();
  } catch (err) {
    logError('Mobile.askNotifications', err);
  }
  await refreshNotificationStatus();
}

/** The app's page in system Settings, where the switch lives once the system stops asking. */
export async function openNotificationSettings(): Promise<void> {
  try {
    if (Capacitor.getPlatform() === 'android') {
      await Downloads.openNotificationSettings();
    } else {
      // iOS' own scheme for the app's page in Settings.
      await launchInSystemBrowser('app-settings:');
    }
  } catch (err) {
    logError('Mobile.openNotificationSettings', err);
  }
}

/**
 * The button behind "Zapnout": the system dialog while it will still appear,
 * otherwise straight to Settings. Android 13+ shows the dialog twice at most,
 * and after that a request returns `denied` without showing anything.
 */
export async function enableNotifications(): Promise<void> {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions();
      await refreshNotificationStatus();
      return;
    }
  } catch (err) {
    logError('Mobile.enableNotifications', err);
  }
  await openNotificationSettings();
}
