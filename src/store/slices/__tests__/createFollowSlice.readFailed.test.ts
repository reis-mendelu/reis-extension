import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createFollowSlice } from '../createFollowSlice';
import type { FollowSlice } from '../createFollowSlice';
import { IndexedDBService } from '../../../services/storage';
import { STORAGE_KEY, CHOSEN_KEY } from '../follows/loadFollows';
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

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

/**
 * A failed read of the saved list leaves `followed` at `[]`, and that `[]` is
 * not what disk holds. A toggle computed from it and persisted would replace
 * the student's saved follows with a one-element list — so it first retries
 * the read once, and if that fails too it keeps the change in memory for the
 * session. "Nothing saved" and "no faculty default" are different: there `[]`
 * IS the answer, and a toggle persists as usual.
 */
describe('createFollowSlice — a failed read of the saved list', () => {
  let state: FollowSlice & {
    societies: Record<string, Society>;
    mapEvents: unknown[];
    rsvp: Record<string, unknown>;
    language: string;
  };
  let disk: Map<string, unknown>;
  /** How many more reads of the list fail. */
  let failingReads: number;

  beforeEach(() => {
    vi.clearAllMocks();
    disk = new Map<string, unknown>([
      [STORAGE_KEY, ['supef', 'zf']],
      [CHOSEN_KEY, true],
    ]);
    failingReads = 0;
    vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) => {
      if (key === STORAGE_KEY && failingReads > 0) {
        failingReads -= 1;
        return Promise.reject(new Error('InvalidStateError'));
      }
      return Promise.resolve(disk.get(key));
    });
    vi.mocked(IndexedDBService.set).mockImplementation(
      (_store: string, key: string, value: unknown) => {
        disk.set(key, value);
        return Promise.resolve(undefined);
      }
    );
    mockGetUserParams.mockReset().mockResolvedValue(null);
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

  it('a toggle after a read that keeps failing leaves the saved list on disk', async () => {
    failingReads = Infinity;
    await state.loadFollows();
    expect(state.followsLoaded).toBe(true);
    expect(state.followsResolved).toBe(false);

    await state.toggleFollow('esn');

    expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'zf']);
    // The session still shows the tap, and the list stays unresolved.
    expect(state.followed).toEqual(['esn']);
    expect(state.followsResolved).toBe(false);
  });

  it('two toggles in a row, both with the read failing, still leave disk alone', async () => {
    failingReads = Infinity;
    await state.loadFollows();

    await state.toggleFollow('esn');
    await state.toggleFollow('ldf');

    expect(state.followed).toEqual(['esn', 'ldf']);
    expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'zf']);
  });

  it('a toggle whose retried read succeeds lands on the saved list and persists', async () => {
    failingReads = 1;
    await state.loadFollows();
    expect(state.followed).toEqual([]);

    await state.toggleFollow('esn');

    expect(state.followed).toEqual(['supef', 'zf', 'esn']);
    expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'zf', 'esn']);
    expect(state.followsResolved).toBe(true);
  });

  it('a later load whose read fails keeps the list a good read already gave', async () => {
    await state.loadFollows();
    expect(state.followed).toEqual(['supef', 'zf']);

    failingReads = Infinity;
    await state.loadFollows();
    expect(state.followed).toEqual(['supef', 'zf']);
    expect(state.followsResolved).toBe(true);

    await state.toggleFollow('esn');
    expect(disk.get(STORAGE_KEY)).toEqual(['supef', 'zf', 'esn']);
  });

  it('retryFollowsIfUnresolved still retries after a failed read, and resolves once it works', async () => {
    failingReads = 1;
    await state.loadFollows();
    expect(state.followsResolved).toBe(false);

    await state.retryFollowsIfUnresolved();

    expect(state.followed).toEqual(['supef', 'zf']);
    expect(state.followsResolved).toBe(true);
  });

  describe('where [] is the answer, a toggle persists', () => {
    it('nothing saved, and IS cannot yet say who is signed in', async () => {
      disk.clear();
      await state.loadFollows();
      expect(state.followsResolved).toBe(false);

      await state.toggleFollow('esn');

      expect(disk.get(STORAGE_KEY)).toEqual(['esn']);
      expect(state.followsResolved).toBe(true);
    });

    it('nothing saved, and the faculty maps to no default society', async () => {
      disk.clear();
      mockGetUserParams.mockResolvedValue({
        studium: 's',
        obdobi: 'o',
        facultyId: '',
        facultyLabel: '99',
        username: 'u',
        studentId: 'id',
        fullName: 'Test',
        isErasmus: false,
      });
      await state.loadFollows();
      expect(state.followed).toEqual([]);

      await state.toggleFollow('esn');

      expect(disk.get(STORAGE_KEY)).toEqual(['esn']);
    });
  });
});
