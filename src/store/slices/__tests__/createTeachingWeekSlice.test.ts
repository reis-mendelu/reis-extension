import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTeachingWeekSlice } from '../createTeachingWeekSlice';
import type { TeachingWeekSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';
import { fetchTeachingWeeks } from '../../../api/teachingWeek';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../api/teachingWeek', () => ({ fetchTeachingWeeks: vi.fn() }));

const CACHED = {
  weeks: [
    { week: 1, from: '2026-09-21', to: '2026-09-27' },
    { week: 2, from: '2026-09-28', to: '2026-10-04' },
  ],
  total: 2,
  currentWeek: null,
};
const FRESH = {
  weeks: [{ week: 1, from: '2026-09-21', to: '2026-09-27' }],
  total: 1,
  currentWeek: 1,
};
/** Last academic year's table: every week of it is already over. */
const STALE = {
  weeks: [{ week: 1, from: '2025-09-22', to: '2025-09-28' }],
  total: 1,
  currentWeek: null,
};

/**
 * The teaching-week table is read from cache BEFORE the network.
 *
 * It is the one input `isOutsideTeaching` has, and it was the only domain the
 * phone re-fetched from scratch on every launch while `schedule` rehydrated
 * from IndexedDB. That asymmetry rendered a confident wrong answer for the
 * seconds the fetch took — the calendar opened on today and then visibly
 * jumped to the first teaching day once the table landed.
 */
describe('createTeachingWeekSlice', () => {
  let state: TeachingWeekSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createTeachingWeekSlice(set, get, {} as any);
  });
  afterEach(() => vi.useRealTimers());

  it('starts with nothing and claims nothing', () => {
    expect(state.teachingWeekData).toBeNull();
  });

  it('shows the cached table before the fetch resolves', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(CACHED);
    let release!: (v: typeof FRESH) => void;
    vi.mocked(fetchTeachingWeeks).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const done = state.fetchTeachingWeek();
    // Let the cache read settle, but not the fetch.
    await vi.waitFor(() => expect(state.teachingWeekData).toEqual(CACHED));

    release(FRESH);
    await done;
    expect(state.teachingWeekData).toEqual(FRESH);
  });

  it('persists what the fetch returns', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    vi.mocked(fetchTeachingWeeks).mockResolvedValue(FRESH);

    await state.fetchTeachingWeek();
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'teaching_weeks', FRESH);
  });

  it('ignores a cached table whose semester is over', async () => {
    // Trusting it would answer "outside the teaching period" from last year's
    // dates — a confident wrong answer, which is what this cache exists to stop.
    vi.mocked(IndexedDBService.get).mockResolvedValue(STALE);
    vi.mocked(fetchTeachingWeeks).mockResolvedValue(FRESH);

    const done = state.fetchTeachingWeek();
    await done;
    expect(set).not.toHaveBeenCalledWith({ teachingWeekData: STALE });
    expect(state.teachingWeekData).toEqual(FRESH);
  });

  it('ignores a cached value that is not a teaching-week table', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue({ nonsense: true });
    vi.mocked(fetchTeachingWeeks).mockResolvedValue(FRESH);

    await state.fetchTeachingWeek();
    expect(state.teachingWeekData).toEqual(FRESH);
  });

  it('keeps the cached table when the fetch comes back empty', async () => {
    // Offline, or IS returned a page the parser could not read. The cached
    // table is old news but it is still the best answer available.
    vi.mocked(IndexedDBService.get).mockResolvedValue(CACHED);
    vi.mocked(fetchTeachingWeeks).mockResolvedValue(null);

    await state.fetchTeachingWeek();
    expect(state.teachingWeekData).toEqual(CACHED);
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });

  it('still fetches when the cache read throws', async () => {
    vi.mocked(IndexedDBService.get).mockRejectedValue(new Error('idb closed'));
    vi.mocked(fetchTeachingWeeks).mockResolvedValue(FRESH);

    await state.fetchTeachingWeek();
    expect(state.teachingWeekData).toEqual(FRESH);
  });
});
