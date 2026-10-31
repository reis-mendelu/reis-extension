import type { AppSlice } from '../types';

/**
 * What the phone's system says about reIS notifications. `unknown` until the
 * native side has been asked, and for ever in the extension, which has no
 * system notifications (src/test/guards/desktopHasNoSystemNotificationSettings).
 */
export type SystemNotificationStatus = 'unknown' | 'granted' | 'denied' | 'prompt';

/**
 * Written by the phone-only permission module under src/mobile, read by the Nastavení row
 * and the bell's banner. State only: the slice imports no Capacitor, so it adds
 * nothing to the extension's content-script graph.
 */
export interface SystemNotificationsSlice {
  systemNotifications: SystemNotificationStatus;
  setSystemNotifications: (next: SystemNotificationStatus) => void;
}

export const createSystemNotificationsSlice: AppSlice<SystemNotificationsSlice> = (set) => ({
  systemNotifications: 'unknown',
  setSystemNotifications: (next) => set({ systemNotifications: next }),
});
