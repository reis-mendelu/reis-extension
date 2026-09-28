import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
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
import {
  runExclusiveLoad,
  ensureLoaded,
  persistField,
  snapshotVersions,
  isUnchangedSince,
} from './follows/followLoadState';

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

export const createFollowSlice: AppSlice<FollowSlice> = (set, get) => ({
  followed: [],
  followsLoaded: false,
  followsResolved: false,
  muted: [],
  notifyPrefs: DEFAULT_PREFS,
  permissionAsked: false,
  notifyPermission: null,

  loadFollows: async () => {
    await runExclusiveLoad(async () => {
      // Snapshot BEFORE the reads start: a mutation that lands while they're
      // in flight bumps its field's version, and the commit below sees the
      // mismatch and skips that field rather than overwriting it with what
      // it read here.
      const versionsAtStart = snapshotVersions();
      const [list, notify] = await Promise.all([
        loadFollowedList(get().societies),
        loadNotifySettings(),
      ]);

      const followedUnchanged = isUnchangedSince('followed', versionsAtStart);
      const patch: Partial<FollowSlice> = {
        followsLoaded: true,
        // `null` means loadFollowedList could not resolve anything this time
        // (getUserParams() came back empty — the boot race) rather than that
        // this student genuinely follows nothing. A toggle that landed on
        // `followed` during this load is just as much a resolved answer — it
        // is a hand-made choice, already persisted with CHOSEN_KEY — so it
        // must not leave a later `retryFollowsIfUnresolved()` blocked
        // forever waiting for a list that will never come.
        followsResolved: list !== null || !followedUnchanged,
      };
      if (followedUnchanged) patch.followed = list ?? [];
      if (isUnchangedSince('muted', versionsAtStart)) patch.muted = notify.muted;
      if (isUnchangedSince('notifyPrefs', versionsAtStart)) patch.notifyPrefs = notify.prefs;
      if (isUnchangedSince('permissionAsked', versionsAtStart)) {
        patch.permissionAsked = notify.asked;
      }

      set(patch);
      get().replanNotifications();
    });
  },

  retryFollowsIfUnresolved: async () => {
    if (get().followsResolved) return;
    // Delegates entirely to `loadFollows()`, which dedupes via `runExclusiveLoad`.
    await get().loadFollows();
  },

  // Every mutation below first calls `ensureLoaded`: it computes from what
  // disk holds, never from the cold-boot `[]` default — persisting a
  // one-element list over the student's real saved follows is the race this
  // exists to close. `persistField` then keeps any load that overlaps the
  // writes (a retry fired by a sync, say) from committing the value it read
  // before they landed; see `followLoadState.ts`.
  toggleFollow: async (id) => {
    await ensureLoaded(get);
    const followed = get().followed.includes(id)
      ? get().followed.filter((x) => x !== id)
      : [...get().followed, id];
    set({ followed });
    await persistField('followed', 'Follows.toggle', async () => {
      // CHOSEN_KEY first, deliberately. There are two writes and no transaction
      // across them, so one of the two orders has to be safe: marking "chosen"
      // before the list means a crash between them leaves the OLD list marked
      // as settled, which is merely stale. The other order leaves the new list
      // unmarked — and if that list is empty, the next boot treats the
      // student's deliberate choice as an unresolved lookup and undoes it.
      await IndexedDBService.set('meta', CHOSEN_KEY, true);
      await IndexedDBService.set('meta', STORAGE_KEY, followed);
    });
    get().replanNotifications();
  },

  toggleMute: async (id) => {
    await ensureLoaded(get);
    const muted = get().muted.includes(id)
      ? get().muted.filter((x) => x !== id)
      : [...get().muted, id];
    set({ muted });
    await persistField('muted', 'Follows.toggleMute', () =>
      IndexedDBService.set('meta', MUTED_KEY, muted)
    );
    get().replanNotifications();
  },

  setNotifyPref: async (key, value) => {
    await ensureLoaded(get);
    const notifyPrefs = { ...get().notifyPrefs, [key]: value };
    set({ notifyPrefs });
    await persistField('notifyPrefs', 'Follows.setNotifyPref', () =>
      IndexedDBService.set('meta', NOTIFY_PREFS_KEY, notifyPrefs)
    );
    get().replanNotifications();
  },

  markPermissionAsked: async () => {
    await ensureLoaded(get);
    set({ permissionAsked: true });
    await persistField('permissionAsked', 'Follows.markPermissionAsked', () =>
      IndexedDBService.set('meta', NOTIFY_ASKED_KEY, true)
    );
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
