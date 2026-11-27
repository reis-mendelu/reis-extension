import type { AppSlice } from '../types';
import type { AppUpdateOffer } from '../../utils/appUpdateOffer';
import type { CriticalVersion } from '../../utils/criticalUpdate';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/** The `meta` key holding the id of the last update offer Novinky showed. */
export const APP_UPDATE_SEEN_KEY = 'app_update_seen';

/**
 * "Nová verze reISu" in the phone's Novinky (src/mobile/appUpdate finds it).
 * Phone and iPad only: the extension updates itself through the browser
 * (guard: extensionHasNoAppUpdate.test.ts).
 *
 * `appUpdateSeenId` is what the bell's badge subtracts. Opening Novinky with
 * the row in it marks it seen, once per version, and the record survives a
 * restart, so the badge does not come back every time the app opens.
 */
export interface AppUpdateSlice {
  appUpdate: AppUpdateOffer | null;
  appUpdateSeenId: string | null;
  setAppUpdate: (offer: AppUpdateOffer | null) => void;
  loadAppUpdateSeen: () => Promise<void>;
  markAppUpdateSeen: () => void;
  /** Set while this install is below the critical version and the store has
   *  the fix (src/mobile/criticalUpdate). Feeds the pop-up and the hint on an
   *  empty Předměty or Zkoušky. Never set in the extension. */
  criticalUpdate: CriticalVersion | null;
  criticalPopupOpen: boolean;
  setCriticalUpdate: (critical: CriticalVersion | null) => void;
  openCriticalPopup: () => void;
  closeCriticalPopup: () => void;
}

export const createAppUpdateSlice: AppSlice<AppUpdateSlice> = (set, get) => ({
  appUpdate: null,
  appUpdateSeenId: null,
  criticalUpdate: null,
  criticalPopupOpen: false,
  setCriticalUpdate: (critical) =>
    set(
      critical ? { criticalUpdate: critical } : { criticalUpdate: null, criticalPopupOpen: false }
    ),
  openCriticalPopup: () => set({ criticalPopupOpen: true }),
  closeCriticalPopup: () => set({ criticalPopupOpen: false }),
  setAppUpdate: (offer) => set({ appUpdate: offer }),
  loadAppUpdateSeen: async () => {
    try {
      const id = (await IndexedDBService.get('meta', APP_UPDATE_SEEN_KEY)) as string | undefined;
      if (id && !get().appUpdateSeenId) set({ appUpdateSeenId: id });
    } catch (err) {
      logError('AppUpdateSlice.loadSeen', err);
    }
  },
  markAppUpdateSeen: () => {
    const id = get().appUpdate?.id;
    if (!id || get().appUpdateSeenId === id) return;
    set({ appUpdateSeenId: id });
    IndexedDBService.set('meta', APP_UPDATE_SEEN_KEY, id).catch((err) =>
      logError('AppUpdateSlice.markSeen', err)
    );
  },
});
