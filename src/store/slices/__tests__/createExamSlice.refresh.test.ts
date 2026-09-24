import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

/**
 * The exams refresh spinner ends when the refresh ANSWERS, not when data does.
 *
 * `refreshExams` only pushes exams when IS returned some — an empty read is how
 * a failed fetch looks too, so it must never overwrite what is on screen. The
 * spinner used to wait for that push, so a student with no exams this month
 * (all of September) watched it spin for the full 15-second fallback after a
 * lookup that took 0.6s.
 */

const refresh = vi.fn<() => Promise<void>>();

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn(async () => {}) },
}));
vi.mock('../../../services/sync/SyncService', () => ({
  syncService: { triggerExamRefresh: () => refresh() },
}));
vi.mock('../exams/fetchExamClassmatesForTermin', () => ({
  fetchAndPersistExamClassmates: vi.fn(),
  persistLastExamClassmatesFetched: vi.fn(),
  EXAM_CLASSMATES_LAST_FETCHED_KEY: 'exam_classmates_last_fetched',
}));
vi.mock('../exams/fetchAllExamClassmates', () => ({
  loadAllExamClassmatesFromCache: vi.fn(),
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { createExamSlice } from '../createExamSlice';
import { logError } from '../../../utils/reportError';

describe('triggerExamsRefresh', () => {
  let state: Record<string, unknown>;
  let slice: ReturnType<typeof createExamSlice>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state = { exams: { data: [], status: 'success', error: null } };
    const set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    }) as Mock & Parameters<typeof createExamSlice>[0];
    const get = vi.fn(() => ({ ...state, ...slice })) as unknown as Parameters<
      typeof createExamSlice
    >[1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createExamSlice(set, get, {} as any);
  });
  afterEach(() => vi.useRealTimers());

  it('stops spinning as soon as a refresh with no exams answers', async () => {
    refresh.mockResolvedValue(undefined);
    slice.triggerExamsRefresh();
    expect(slice.examsRefreshing).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.examsRefreshing).toBe(false);
  });

  it('stops spinning when the refresh fails, and says why locally', async () => {
    refresh.mockRejectedValue(new Error('boom'));
    slice.triggerExamsRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.examsRefreshing).toBe(false);
    expect(logError).toHaveBeenCalledWith('ExamSlice.triggerExamsRefresh', expect.any(Error));
  });

  it('still gives up after 15s if the refresh never answers', async () => {
    refresh.mockReturnValue(new Promise(() => {}));
    slice.triggerExamsRefresh();
    await vi.advanceTimersByTimeAsync(14_000);
    expect(slice.examsRefreshing).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(slice.examsRefreshing).toBe(false);
  });

  it('does not start a second refresh while one is running', () => {
    refresh.mockReturnValue(new Promise(() => {}));
    slice.triggerExamsRefresh();
    slice.triggerExamsRefresh();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a late answer from a timed-out refresh does not end the next one', async () => {
    // First request never answers in time: the 15s backstop releases the flag.
    let lateFirst!: () => void;
    refresh.mockReturnValueOnce(new Promise<void>((r) => (lateFirst = r)));
    slice.triggerExamsRefresh();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(slice.examsRefreshing).toBe(false);
    // A second one starts, and the first finally answers while it runs.
    refresh.mockReturnValueOnce(new Promise(() => {}));
    slice.triggerExamsRefresh();
    expect(slice.examsRefreshing).toBe(true);
    lateFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.examsRefreshing).toBe(true);
  });

  it("the first refresh's backstop does not end a later one either", async () => {
    refresh.mockResolvedValueOnce(undefined);
    slice.triggerExamsRefresh();
    await vi.advanceTimersByTimeAsync(0);
    refresh.mockReturnValueOnce(new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(10_000);
    slice.triggerExamsRefresh();
    // The first run's 15s timer fires 5s into the second run.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(slice.examsRefreshing).toBe(true);
  });
});
