import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createFollowSlice, DEFAULT_PREFS } from '../createFollowSlice';
import type { FollowSlice } from '../createFollowSlice';
import { IndexedDBService } from '../../../services/storage';
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

function makeUser(facultyLabel: string | null, isErasmus: boolean) {
  return {
    studium: 's',
    obdobi: 'o',
    facultyId: '',
    facultyLabel: facultyLabel ?? '',
    username: 'u',
    studentId: 'id',
    fullName: 'Test',
    isErasmus,
  };
}

describe('createFollowSlice', () => {
  // The slice reads `societies` off the composed store (for the faculty
  // auto-follow default); the test supplies just that one neighbour rather
  // than the whole thing — same pattern as createRsvpSlice's test.
  let state: FollowSlice & { societies: Record<string, Society> };
  let set: Mock & Parameters<typeof createFollowSlice>[0];
  let get: Mock & Parameters<typeof createFollowSlice>[1];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    vi.mocked(IndexedDBService.set).mockResolvedValue(undefined);
    set = vi.fn((fn) => {
      const patch = typeof fn === 'function' ? fn(state) : fn;
      Object.assign(state, patch);
    });
    get = vi.fn(() => state) as unknown as typeof get;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = {
      ...createFollowSlice(set, get, {} as any),
      // Faculty defaults come from the societies catalog: PEF->supef (same
      // fixtures useSpolkySettings' own test used before this logic moved
      // here).
      societies: BUNDLED_SOCIETIES,
    };
  });

  it('initializes with empty defaults', () => {
    expect(state.followed).toEqual([]);
    expect(state.followsLoaded).toBe(false);
    expect(state.muted).toEqual([]);
    expect(state.notifyPrefs).toEqual(DEFAULT_PREFS);
    expect(state.permissionAsked).toBe(false);
    expect(state.notifyPermission).toBeNull();
  });

  describe('loadFollows', () => {
    it('with a saved list, followed equals it and followsLoaded is true', async () => {
      vi.mocked(IndexedDBService.get).mockImplementation((store: string, key: string) => {
        if (store === 'meta' && key === 'reis_subscribed_associations')
          return Promise.resolve(['supef']);
        return Promise.resolve(undefined);
      });

      await state.loadFollows();

      expect(state.followed).toEqual(['supef']);
      expect(state.followsLoaded).toBe(true);
    });

    it('with nothing saved, a PEF faculty and no Erasmus, auto-follows the catalog default', async () => {
      mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

      await state.loadFollows();

      expect(state.followed).toEqual(['supef']);
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_subscribed_associations', [
        'supef',
      ]);
    });

    it('an Erasmus student auto-follows ESN and the flag is set', async () => {
      mockGetUserParams.mockResolvedValue(makeUser('PEF', true));

      await state.loadFollows();

      expect(state.followed).toEqual(['esn']);
      expect(IndexedDBService.set).toHaveBeenCalledWith(
        'meta',
        'reis_erasmus_auto_subscribed',
        true
      );
    });

    it('a saved [] without reis_associations_chosen is re-resolved once, and marks chosen', async () => {
      vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) =>
        Promise.resolve(key === 'reis_subscribed_associations' ? [] : undefined)
      );
      mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

      await state.loadFollows();

      expect(state.followed).toEqual(['supef']);
      expect(
        vi
          .mocked(IndexedDBService.set)
          .mock.calls.some((c) => c[1] === 'reis_associations_chosen' && c[2] === true)
      ).toBe(true);
    });

    it('a saved [] WITH chosen stays []', async () => {
      vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) =>
        Promise.resolve(
          key === 'reis_subscribed_associations' ? [] : key === 'reis_associations_chosen'
        )
      );
      mockGetUserParams.mockResolvedValue(makeUser('PEF', false));

      await state.loadFollows();

      expect(state.followed).toEqual([]);
    });

    it('migrates a renamed id in the saved list', async () => {
      vi.mocked(IndexedDBService.get).mockImplementation((store: string, key: string) => {
        if (store === 'meta' && key === 'reis_subscribed_associations')
          return Promise.resolve(['af']);
        return Promise.resolve(undefined);
      });
      mockGetUserParams.mockResolvedValue(makeUser('AF', false));

      await state.loadFollows();

      expect(state.followed).toEqual(['usaf']);
    });

    it('reads muted, prefs and asked with defaults when nothing is saved', async () => {
      await state.loadFollows();

      expect(state.muted).toEqual([]);
      expect(state.notifyPrefs).toEqual(DEFAULT_PREFS);
      expect(state.permissionAsked).toBe(false);
    });

    it('reads saved muted, prefs and asked', async () => {
      vi.mocked(IndexedDBService.get).mockImplementation((store: string, key: string) => {
        if (store === 'meta' && key === 'reis_muted_associations') return Promise.resolve(['zf']);
        if (store === 'meta' && key === 'reis_notify_prefs')
          return Promise.resolve({ myEvents: false, followedEvents: true, newEvents: false });
        if (store === 'meta' && key === 'reis_notify_asked') return Promise.resolve(true);
        return Promise.resolve(undefined);
      });

      await state.loadFollows();

      expect(state.muted).toEqual(['zf']);
      expect(state.notifyPrefs).toEqual({
        myEvents: false,
        followedEvents: true,
        newEvents: false,
      });
      expect(state.permissionAsked).toBe(true);
    });
  });

  describe('toggleFollow', () => {
    it('adds an id, persists it, and writes chosen before the list', async () => {
      state.followed = [];
      const order: unknown[][] = [];
      vi.mocked(IndexedDBService.set).mockImplementation((...args: unknown[]) => {
        order.push(args);
        return Promise.resolve(undefined);
      });

      await state.toggleFollow('esn');

      expect(state.followed).toEqual(['esn']);
      expect(order[0]).toEqual(['meta', 'reis_associations_chosen', true]);
      expect(order[1]).toEqual(['meta', 'reis_subscribed_associations', ['esn']]);
    });

    it('removes an already-followed id', async () => {
      state.followed = ['esn'];

      await state.toggleFollow('esn');

      expect(state.followed).toEqual([]);
    });
  });

  describe('toggleMute', () => {
    it('adds and persists a muted id', async () => {
      state.muted = [];

      await state.toggleMute('zf');

      expect(state.muted).toEqual(['zf']);
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_muted_associations', ['zf']);
    });

    it('removes an already-muted id', async () => {
      state.muted = ['zf'];

      await state.toggleMute('zf');

      expect(state.muted).toEqual([]);
    });
  });

  describe('setNotifyPref', () => {
    it('flips one preference and persists the whole object', async () => {
      await state.setNotifyPref('myEvents', false);

      expect(state.notifyPrefs).toEqual({ ...DEFAULT_PREFS, myEvents: false });
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_notify_prefs', {
        ...DEFAULT_PREFS,
        myEvents: false,
      });
    });
  });

  describe('markPermissionAsked', () => {
    it('sets and persists the asked flag', async () => {
      await state.markPermissionAsked();

      expect(state.permissionAsked).toBe(true);
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'reis_notify_asked', true);
    });
  });

  describe('setNotifyPermission', () => {
    it('sets the permission synchronously, with no persistence', () => {
      state.setNotifyPermission('granted');

      expect(state.notifyPermission).toBe('granted');
      expect(IndexedDBService.set).not.toHaveBeenCalled();
    });
  });
});
