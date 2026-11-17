import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/**
 * What the phone's system says about reIS notifications. `unknown` until the
 * native side has been asked, and for ever in the extension, which has no
 * system notifications (src/test/guards/desktopHasNoSystemNotificationSettings).
 */
export type SystemNotificationStatus = 'unknown' | 'granted' | 'denied' | 'prompt';

/** The 'meta' key of the "Od spolků a MENDELU" switch; absent = on. */
export const NOTIFY_SOCIETIES_KEY = 'notify_societies';

/**
 * Written by the phone-only permission module under src/mobile, read by the Nastavení row
 * and the bell's banner. Imports no Capacitor, so it adds nothing to the
 * extension's content-script graph.
 */
export interface SystemNotificationsSlice {
  systemNotifications: SystemNotificationStatus;
  setSystemNotifications: (next: SystemNotificationStatus) => void;
  /**
   * Society events and MENDELU notices as phone notifications too. On unless
   * the student switched it off (agreed 2026-11-17); Novinky lists them either way.
   */
  notifySocieties: boolean;
  /** The student flipped it this session: their choice beats the boot read. */
  notifySocietiesTouched: boolean;
  setNotifySocieties: (on: boolean) => void;
  loadNotifySocieties: () => Promise<void>;
}

export const createSystemNotificationsSlice: AppSlice<SystemNotificationsSlice> = (set, get) => ({
  systemNotifications: 'unknown',
  setSystemNotifications: (next) => set({ systemNotifications: next }),
  notifySocieties: true,
  notifySocietiesTouched: false,
  setNotifySocieties: (on) => {
    set({ notifySocieties: on, notifySocietiesTouched: true });
    IndexedDBService.set('meta', NOTIFY_SOCIETIES_KEY, on).catch((err) =>
      logError('SystemNotificationsSlice.setNotifySocieties', err)
    );
  },
  loadNotifySocieties: async () => {
    try {
      const stored = await IndexedDBService.get('meta', NOTIFY_SOCIETIES_KEY);
      // The student flipped it while this was loading: their choice wins.
      if (get().notifySocietiesTouched) return;
      if (typeof stored === 'boolean') set({ notifySocieties: stored });
    } catch (err) {
      logError('SystemNotificationsSlice.loadNotifySocieties', err);
    }
  },
});
