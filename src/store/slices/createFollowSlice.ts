import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import {
  loadFollowedList,
  loadNotifySettings,
  STORAGE_KEY,
  CHOSEN_KEY,
  MUTED_KEY,
  NOTIFY_PREFS_KEY,
  NOTIFY_ASKED_KEY,
  DEFAULT_PREFS,
  type NotifyPrefs,
} from './follows/loadFollows';

export type { NotifyPrefs };
export { DEFAULT_PREFS };

export type NotifyPermission =
  'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported' | null; // null = not read yet

export interface FollowSlice {
  /** Society ids this student follows. */
  followed: string[];
  /** True once the initial `loadFollows()` has resolved. */
  followsLoaded: boolean;
  /** Followed society ids this student has muted from reminders. */
  muted: string[];
  /** Which kinds of notification this student wants scheduled. */
  notifyPrefs: NotifyPrefs;
  /** Whether the soft-ask card has already been shown and answered. */
  permissionAsked: boolean;
  /** The OS notification permission, as last read; `null` = not read yet. */
  notifyPermission: NotifyPermission;
  loadFollows: () => Promise<void>;
  toggleFollow: (id: string) => Promise<void>;
  toggleMute: (id: string) => Promise<void>;
  setNotifyPref: (key: keyof NotifyPrefs, value: boolean) => Promise<void>;
  markPermissionAsked: () => Promise<void>;
  setNotifyPermission: (p: NotifyPermission) => void;
  /** Recomputes and syncs every pending notification. Set in Task 5; a no-op until then. */
  replanNotifications: () => void;
}

export const createFollowSlice: AppSlice<FollowSlice> = (set, get) => ({
  followed: [],
  followsLoaded: false,
  muted: [],
  notifyPrefs: DEFAULT_PREFS,
  permissionAsked: false,
  notifyPermission: null,

  loadFollows: async () => {
    const [list, notify] = await Promise.all([
      loadFollowedList(get().societies),
      loadNotifySettings(),
    ]);
    set({
      followed: list ?? [],
      followsLoaded: true,
      muted: notify.muted,
      notifyPrefs: notify.prefs,
      permissionAsked: notify.asked,
    });
    get().replanNotifications();
  },

  toggleFollow: async (id) => {
    const followed = get().followed.includes(id)
      ? get().followed.filter((x) => x !== id)
      : [...get().followed, id];
    set({ followed });
    try {
      // CHOSEN_KEY first, deliberately. There are two writes and no transaction
      // across them, so one of the two orders has to be safe: marking "chosen"
      // before the list means a crash between them leaves the OLD list marked
      // as settled, which is merely stale. The other order leaves the new list
      // unmarked — and if that list is empty, the next boot treats the
      // student's deliberate choice as an unresolved lookup and undoes it.
      await IndexedDBService.set('meta', CHOSEN_KEY, true);
      await IndexedDBService.set('meta', STORAGE_KEY, followed);
    } catch (err) {
      logError('Follows.toggle', err);
    }
    get().replanNotifications();
  },

  toggleMute: async (id) => {
    const muted = get().muted.includes(id)
      ? get().muted.filter((x) => x !== id)
      : [...get().muted, id];
    set({ muted });
    try {
      await IndexedDBService.set('meta', MUTED_KEY, muted);
    } catch (err) {
      logError('Follows.toggleMute', err);
    }
    get().replanNotifications();
  },

  setNotifyPref: async (key, value) => {
    const notifyPrefs = { ...get().notifyPrefs, [key]: value };
    set({ notifyPrefs });
    try {
      await IndexedDBService.set('meta', NOTIFY_PREFS_KEY, notifyPrefs);
    } catch (err) {
      logError('Follows.setNotifyPref', err);
    }
    get().replanNotifications();
  },

  markPermissionAsked: async () => {
    set({ permissionAsked: true });
    try {
      await IndexedDBService.set('meta', NOTIFY_ASKED_KEY, true);
    } catch (err) {
      logError('Follows.markPermissionAsked', err);
    }
    get().replanNotifications();
  },

  setNotifyPermission: (notifyPermission) => set({ notifyPermission }),

  // Implemented in Task 5 — recomputes the RSVP pings and the evening digest
  // from `followed`/`muted`/`notifyPrefs` and syncs them with the OS. A no-op
  // here so every write above can call it unconditionally.
  replanNotifications: () => {},
});
