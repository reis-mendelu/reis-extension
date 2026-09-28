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

function makeUser(facultyLabel: string, isErasmus: boolean) {
  return {
    studium: 's',
    obdobi: 'o',
    facultyId: '',
    facultyLabel,
    username: 'u',
    studentId: 'id',
    fullName: 'Test',
    isErasmus,
  };
}

/**
 * A load's OWN disk writes (the faculty default, the renamed-id migration, the
 * Erasmus back-fill) are each computed from a read made earlier in the load.
 * `loadFollows` already skips committing `followed` to memory when a toggle
 * landed meanwhile; these pin that it skips writing it to disk as well, or the
 * student's pick is lost at the next boot while memory still shows it.
 */
describe('createFollowSlice — a load does not write over a toggle that landed during it', () => {
  let state: FollowSlice & {
    societies: Record<string, Society>;
    mapEvents: unknown[];
    rsvp: Record<string, unknown>;
    language: string;
  };
  let disk: Map<string, unknown>;
  let releaseChosen: () => void;
  let releaseUser: (user: unknown) => void;

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

  /** Holds the toggle's first write (CHOSEN_KEY) until `releaseChosen()`. */
  function holdChosenWrite() {
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
  }

  /** Holds the next getUserParams() until `releaseUser(user)`. */
  function holdUser() {
    mockGetUserParams.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUser = resolve;
        })
    );
  }

  const tick = () => new Promise((r) => setTimeout(r, 0));

  // The probe: the first load comes back unresolved, the student toggles, a
  // load reads STORAGE_KEY between the toggle's two writes (still undefined),
  // and getUserParams resolves only after the toggle's list write — so the
  // load's faculty default used to land on top of it.
  it('the faculty-default write does not overwrite the toggle', async () => {
    await state.loadFollows();
    expect(state.followsResolved).toBe(false);

    holdChosenWrite();
    holdUser();
    const toggle = state.toggleFollow('esn');
    await tick();
    const load = state.loadFollows();
    await tick();

    releaseChosen();
    await toggle;
    expect(disk.get(STORAGE_KEY)).toEqual(['esn']);

    releaseUser(makeUser('PEF', false));
    await load;

    expect(state.followed).toEqual(['esn']);
    expect(disk.get(STORAGE_KEY)).toEqual(['esn']);
    expect(disk.get(CHOSEN_KEY)).toBe(true);
  });

  it('the renamed-id migration does not overwrite the toggle', async () => {
    // 'af' is a renamed id (-> 'usaf'). The first load's migration write
    // fails, so disk keeps the old id while memory holds the migrated one.
    disk.set(STORAGE_KEY, ['af']);
    disk.set(CHOSEN_KEY, true);
    vi.mocked(IndexedDBService.set).mockRejectedValueOnce(new Error('QuotaExceededError'));
    await state.loadFollows();
    expect(state.followed).toEqual(['usaf']);
    expect(disk.get(STORAGE_KEY)).toEqual(['af']);

    holdChosenWrite();
    const toggle = state.toggleFollow('esn');
    await tick();
    // A load whose read of the list (still ['af']) is held until the toggle
    // has written, so its migration write comes after the toggle's.
    let releaseRead!: () => void;
    vi.mocked(IndexedDBService.get).mockImplementation((_store: string, key: string) => {
      const value = disk.get(key);
      if (key !== STORAGE_KEY) return Promise.resolve(value);
      return new Promise((resolve) => {
        releaseRead = () => resolve(value);
      });
    });
    const load = state.loadFollows();
    await tick();

    releaseChosen();
    await toggle;
    expect(disk.get(STORAGE_KEY)).toEqual(['usaf', 'esn']);

    releaseRead();
    await load;

    expect(state.followed).toEqual(['usaf', 'esn']);
    expect(disk.get(STORAGE_KEY)).toEqual(['usaf', 'esn']);
  });

  it('the Erasmus back-fill does not overwrite the toggle', async () => {
    disk.set(STORAGE_KEY, ['ldf']);
    disk.set(CHOSEN_KEY, true);
    await state.loadFollows();
    expect(state.followed).toEqual(['ldf']);

    holdChosenWrite();
    holdUser();
    const toggle = state.toggleFollow('ldf');
    await tick();
    const load = state.loadFollows();
    await tick();

    releaseChosen();
    await toggle;
    expect(disk.get(STORAGE_KEY)).toEqual([]);

    releaseUser(makeUser('LDF', true));
    await load;

    expect(state.followed).toEqual([]);
    expect(disk.get(STORAGE_KEY)).toEqual([]);
  });
});
