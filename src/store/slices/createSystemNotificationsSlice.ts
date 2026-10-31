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
  /**
   * The Android background check (see desktopHasNoBackgroundCheck.test.ts): `unknown`
   * until the native side has answered, and for ever on iOS and in the
   * extension, which have none.
   */
  backgroundCheck: 'unknown' | 'on' | 'off';
  setBackgroundCheck: (next: 'on' | 'off') => void;
}

export const createSystemNotificationsSlice: AppSlice<SystemNotificationsSlice> = (set) => ({
  systemNotifications: 'unknown',
  setSystemNotifications: (next) => set({ systemNotifications: next }),
  backgroundCheck: 'unknown',
  setBackgroundCheck: (next) => set({ backgroundCheck: next }),
});
