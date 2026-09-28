import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import {
  loadFollowedList,
  MUTED_KEY,
  NOTIFY_PREFS_KEY,
  NOTIFY_ASKED_KEY,
  DEFAULT_PREFS,
  type NotifyPrefs,
} from './follows/loadFollows';
import { loadNotifySettings } from './follows/loadNotifySettings';
import { loadCommitPatch } from './follows/loadCommitPatch';
import { replanNotifications } from './follows/replanNotifications';
import { toggleFollowAction } from './follows/toggleFollow';
import {
  runExclusiveLoad,
  ensureLoaded,
  ensureNotifySettingsRead,
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
  /**
   * True once a load has read the saved list from disk, whatever it found.
   * Until then `followed` is `[]` because the read failed (or has not run),
   * not because disk says so, and `toggleFollow` must not persist a list
   * computed from it.
   */
  followsListRead: boolean;
  /** The same for `muted`/`notifyPrefs`/`permissionAsked`: false until their
   *  read has worked, and `toggleMute`/`setNotifyPref` persist only once true. */
  notifySettingsRead: boolean;
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
   * list or never read the notification settings (a failed read leaves every
   * replan skipped). A no-op once both are in, and concurrent calls share one
   * in-flight load rather than each starting their own.
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
  followsListRead: false,
  notifySettingsRead: false,
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
        loadFollowedList(get().societies, () => isUnchangedSince('followed', versionsAtStart)),
        loadNotifySettings(),
      ]);

      set(loadCommitPatch(list, notify, versionsAtStart));
      get().replanNotifications();
    });
  },

  retryFollowsIfUnresolved: async () => {
    if (get().followsResolved && get().notifySettingsRead) return;
    // Delegates entirely to `loadFollows()`, which dedupes via `runExclusiveLoad`.
    await get().loadFollows();
  },

  // Every mutation below first calls `ensureLoaded`: it computes from what
  // disk holds, never from the cold-boot `[]` default — persisting a
  // one-element list over the student's real saved follows is the race this
  // exists to close. `persistField` then keeps any load that overlaps the
  // writes (a retry fired by a sync, say) from committing the value it read
  // before they landed; see `followLoadState.ts`.
  toggleFollow: (id) => toggleFollowAction(id, set, get),

  toggleMute: async (id) => {
    const canPersist = await ensureNotifySettingsRead(get);
    const muted = get().muted.includes(id)
      ? get().muted.filter((x) => x !== id)
      : [...get().muted, id];
    set({ muted });
    if (canPersist) {
      await persistField('muted', 'Follows.toggleMute', () =>
        IndexedDBService.set('meta', MUTED_KEY, muted)
      );
    }
    get().replanNotifications();
  },

  setNotifyPref: async (key, value) => {
    const canPersist = await ensureNotifySettingsRead(get);
    const notifyPrefs = { ...get().notifyPrefs, [key]: value };
    set({ notifyPrefs });
    if (canPersist) {
      await persistField('notifyPrefs', 'Follows.setNotifyPref', () =>
        IndexedDBService.set('meta', NOTIFY_PREFS_KEY, notifyPrefs)
      );
    }
    get().replanNotifications();
  },

  // Writes a constant `true`, never a value computed from the read, so a
  // failed settings read leaves it nothing to overwrite: it always persists.
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
