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
import { replanNotifications } from './follows/replanNotifications';

export type { NotifyPrefs };
export { DEFAULT_PREFS };

export type NotifyPermission =
  'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unsupported' | null; // null = not read yet

export interface FollowSlice {
  /** Society ids this student follows. */
  followed: string[];
  /** True once the initial `loadFollows()` has resolved — settles exactly
   *  once, even when nothing could be resolved (see `followsResolved`). */
  followsLoaded: boolean;
  /**
   * True only when `loadFollowedList` actually resolved a list (a saved
   * list, or a faculty/Erasmus default) rather than coming back `null`.
   *
   * `loadFollows()` runs once at boot (Tier 2), before IS has necessarily
   * confirmed who is signed in — `getUserParams()` can lose that race,
   * especially on a long-lived Capacitor process. The old hook got
   * incidental retries for free from every component that mounted it (the
   * map, Profile, Novinky); this flag is what lets `retryFollowsIfUnresolved`
   * reproduce that without retrying forever once a real answer is in.
   */
  followsResolved: boolean;
  /** Followed society ids this student has muted from reminders. */
  muted: string[];
  /** Which kinds of notification this student wants scheduled. */
  notifyPrefs: NotifyPrefs;
  /** Whether the soft-ask card has already been shown and answered. */
  permissionAsked: boolean;
  /** The OS notification permission, as last read; `null` = not read yet. */
  notifyPermission: NotifyPermission;
  loadFollows: () => Promise<void>;
  /**
   * Re-runs `loadFollows()` if — and only if — it never actually resolved a
   * list. A no-op once `followsResolved` is true, and concurrent calls share
   * one in-flight load rather than each starting their own.
   */
  retryFollowsIfUnresolved: () => Promise<void>;
  toggleFollow: (id: string) => Promise<void>;
  toggleMute: (id: string) => Promise<void>;
  setNotifyPref: (key: keyof NotifyPrefs, value: boolean) => Promise<void>;
  markPermissionAsked: () => Promise<void>;
  setNotifyPermission: (p: NotifyPermission) => void;
  /** Recomputes and syncs every pending notification. Set in Task 5; a no-op until then. */
  replanNotifications: () => void;
}

// One in-flight LOAD at a time, shared by both `loadFollows()` and
// `retryFollowsIfUnresolved()` — module-level rather than per-slice-instance
// state because there is exactly one store, and any two callers landing close
// together must await the SAME load rather than each kick off its own. That
// used to be true only of two concurrent `retryFollowsIfUnresolved()` calls;
// the boot call site (`void loadFollows()` in useAppStore.ts) bypassed this
// entirely, so a sync arriving mid-boot could still start a second concurrent
// load racing it. Routing `loadFollows()` itself through this flag closes
// that gap for every caller, not just retries. Cleared in `finally` so a
// later, genuinely new load can still run once this one settles.
let followsLoadInFlight: Promise<void> | null = null;

export const createFollowSlice: AppSlice<FollowSlice> = (set, get) => ({
  followed: [],
  followsLoaded: false,
  followsResolved: false,
  muted: [],
  notifyPrefs: DEFAULT_PREFS,
  permissionAsked: false,
  notifyPermission: null,

  loadFollows: async () => {
    if (!followsLoadInFlight) {
      followsLoadInFlight = (async () => {
        const [list, notify] = await Promise.all([
          loadFollowedList(get().societies),
          loadNotifySettings(),
        ]);
        set({
          followed: list ?? [],
          followsLoaded: true,
          // `null` means loadFollowedList could not resolve anything this time
          // (getUserParams() came back empty — the boot race) rather than that
          // this student genuinely follows nothing.
          followsResolved: list !== null,
          muted: notify.muted,
          notifyPrefs: notify.prefs,
          permissionAsked: notify.asked,
        });
        get().replanNotifications();
      })().finally(() => {
        followsLoadInFlight = null;
      });
    }
    await followsLoadInFlight;
  },

  retryFollowsIfUnresolved: async () => {
    if (get().followsResolved) return;
    // Delegates entirely to `loadFollows()`, which now does its own
    // deduplication — see `followsLoadInFlight` above.
    await get().loadFollows();
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

  setNotifyPermission: (notifyPermission) => {
    const wasGranted = get().notifyPermission === 'granted';
    set({ notifyPermission });
    // A grant made in the phone's Settings reaches the store only through the
    // resume read, and nothing else would replan then. Only on the transition:
    // every resume re-reads the permission, and an unchanged 'granted' has
    // nothing new to schedule.
    if (notifyPermission === 'granted' && !wasGranted) get().replanNotifications();
  },

  // Recomputes the RSVP pings and the evening digest from
  // `followed`/`muted`/`notifyPrefs`/`mapEvents`/`rsvp` and syncs them with
  // the OS. Every write above calls this unconditionally.
  replanNotifications: () => replanNotifications(get),
});
