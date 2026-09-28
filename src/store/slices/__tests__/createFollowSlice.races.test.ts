import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createFollowSlice } from '../createFollowSlice';
import type { FollowSlice } from '../createFollowSlice';
import { IndexedDBService } from '../../../services/storage';
import { STORAGE_KEY, CHOSEN_KEY, MUTED_KEY } from '../follows/loadFollows';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import type { Society } from '../../../types/events';

const mockGetUserParams = vi.fn();

vi.mock('../../../utils/userParams', () => ({
  getUserParams: (...args: unknown[]) => mockGetUserParams(...args),
}));

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

/**
 * The two races a review of 98f03cc3 confirmed with probes, against a small
 * in-memory `meta` store so "what is on disk" is a real question here rather
 * than an inspection of mock calls.
 *
 * 1. A mutation that runs BEFORE any `loadFollows()` has started (Tier 2
 *    awaits three hydrate reads before it fires the load, and FollowChip has
 *    no `followsLoaded` gate) used to compute from the cold `followed: []`
 *    and persist a one-element list over the saved follows.
 * 2. A load that starts while a mutation is still persisting used to read the
 *    OLD disk value and commit it, reverting the toggle in memory while disk
 *    kept it.
 */
describe('createFollowSlice races', () => {
  let state: FollowSlice & {
    societies: Record<string, Society>;
    mapEvents: unknown[];
    rsvp: Record<string, unknown>;
    language: string;
  };
  let disk: Map<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    disk = new Map();
    vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) =>
      Promise.resolve(disk.get(key))
    );
    vi.mocked(IndexedDBService.set).mockImplementation(
      (_store: string, key: string, value: unknown) => {
        disk.set(key, value);
        return Promise.resolve(undefined);
      }
    );
    mockGetUserParams.mockResolvedValue(null);
    const set = vi.fn((fn) => {
      const patch = typeof fn === 'function' ? fn(state) : fn;
      Object.assign(state, patch);
    }) as Mock & Parameters<typeof createFollowSlice>[0];
    const get = vi.fn(() => state) as unknown as Parameters<typeof createFollowSlice>[1];
    state = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...createFollowSlice(set, get, {} as any),
      societies: BUNDLED_SOCIETIES,
      mapEvents: [],
      rsvp: {},
      language: 'cz',
    };
  });

  describe('a mutation before any load has started', () => {
    it('toggleFollow keeps the saved follows, in memory and on disk', async () => {
      disk.set(STORAGE_KEY, ['supef']);
      disk.set(CHOSEN_KEY, true);

      await state.toggleFollow('esn');
      // The Tier 2 boot load, arriving late.
      await state.loadFollows();

      expect(state.followed).toEqual(['supef', 'esn']);
      expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'esn']);
      expect(state.followsLoaded).toBe(true);
      expect(state.followsResolved).toBe(true);
    });

    it('toggleMute keeps the saved mutes, in memory and on disk', async () => {
      disk.set(MUTED_KEY, ['zf']);

      await state.toggleMute('esn');
      await state.loadFollows();

      expect(state.muted).toEqual(['zf', 'esn']);
      expect(disk.get(MUTED_KEY)).toEqual(['zf', 'esn']);
    });

    it('setNotifyPref keeps the other saved switches', async () => {
      const saved = { myEvents: false, followedEvents: false, newEvents: true };
      disk.set('reis_notify_prefs', saved);

      await state.setNotifyPref('newEvents', false);

      expect(state.notifyPrefs).toEqual({ ...saved, newEvents: false });
      expect(disk.get('reis_notify_prefs')).toEqual({ ...saved, newEvents: false });
    });

    // The load a mutation starts for itself is the same one a concurrent
    // retry joins: one real load, and the toggle lands on top of its result.
    it('the load toggleFollow starts and a concurrent retry share one load', async () => {
      disk.set(STORAGE_KEY, ['supef']);
      disk.set(CHOSEN_KEY, true);
      let releaseUser!: () => void;
      mockGetUserParams
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseUser = () => resolve(null);
            })
        )
        .mockResolvedValue(null);

      const toggle = state.toggleFollow('esn');
      const retry = state.retryFollowsIfUnresolved();
      await new Promise((r) => setTimeout(r, 0));
      expect(mockGetUserParams).toHaveBeenCalledTimes(1);

      releaseUser();
      await Promise.all([toggle, retry]);

      expect(mockGetUserParams).toHaveBeenCalledTimes(1);
      expect(state.followed).toEqual(['supef', 'esn']);
      expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'esn']);
    });
  });

  describe('a load that starts while a mutation is persisting', () => {
    // The trigger: the first load came back unresolved (getUserParams lost the
    // boot race), the student toggles, and a sync calls
    // retryFollowsIfUnresolved() in the gap between toggleFollow's two writes.
    it('committing mid-write does not revert the toggle, and marks the list resolved', async () => {
      await state.loadFollows();
      expect(state.followsResolved).toBe(false);

      let releaseChosen!: () => void;
      vi.mocked(IndexedDBService.set).mockImplementation(
        (_store: string, key: string, value: unknown) => {
          if (key === CHOSEN_KEY) {
            return new Promise<undefined>((resolve) => {
              releaseChosen = () => {
                disk.set(key, value);
                resolve(undefined);
              };
            });
          }
          disk.set(key, value);
          return Promise.resolve(undefined);
        }
      );

      const toggle = state.toggleFollow('esn');
      await new Promise((r) => setTimeout(r, 0));
      // The load runs to completion while CHOSEN_KEY is still being written.
      await state.retryFollowsIfUnresolved();
      expect(state.followed).toEqual(['esn']);

      releaseChosen();
      await toggle;

      expect(state.followed).toEqual(['esn']);
      expect(disk.get(STORAGE_KEY)).toEqual(['esn']);
      // The load saw a hand-made choice in flight: that is a resolved answer.
      expect(state.followsResolved).toBe(true);
    });

    it('a load that read the old list mid-write and commits after the write settles does not revert it', async () => {
      await state.loadFollows();
      expect(state.followsResolved).toBe(false);

      let releaseChosen!: () => void;
      vi.mocked(IndexedDBService.set).mockImplementation(
        (_store: string, key: string, value: unknown) => {
          if (key === CHOSEN_KEY) {
            return new Promise<undefined>((resolve) => {
              releaseChosen = () => {
                disk.set(key, value);
                resolve(undefined);
              };
            });
          }
          disk.set(key, value);
          return Promise.resolve(undefined);
        }
      );
      // The retry's read of the list sees the OLD disk value, but is held
      // until after the toggle's writes have both finished.
      let releaseRead!: () => void;
      vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) => {
        const value = disk.get(key);
        if (key !== STORAGE_KEY) return Promise.resolve(value);
        return new Promise((resolve) => {
          releaseRead = () => resolve(value);
        });
      });

      const toggle = state.toggleFollow('esn');
      await new Promise((r) => setTimeout(r, 0));
      // The toggle already resolved the list, so a retry has nothing to do;
      // a plain load still exercises the mid-write commit guard.
      expect(state.followsResolved).toBe(true);
      const retry = state.loadFollows();
      await new Promise((r) => setTimeout(r, 0));

      releaseChosen();
      await toggle;
      expect(disk.get(STORAGE_KEY)).toEqual(['esn']);

      releaseRead();
      await retry;

      expect(state.followed).toEqual(['esn']);
      expect(state.followsResolved).toBe(true);
    });
  });
});
