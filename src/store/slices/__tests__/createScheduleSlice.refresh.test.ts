import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

/**
 * The calendar's refresh: the timetable only, and a spinner that ends when the
 * refresh answers. The same contract as `triggerExamsRefresh` next door.
 */

const refresh = vi.fn<() => Promise<void>>();

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn(async () => {}) },
}));
vi.mock('../../../services/sync/SyncService', () => ({
  syncService: { triggerScheduleRefresh: () => refresh() },
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

import { createScheduleSlice } from '../createScheduleSlice';
import { logError } from '../../../utils/reportError';

describe('triggerScheduleRefresh', () => {
  let state: Record<string, unknown>;
  let slice: ReturnType<typeof createScheduleSlice>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state = {};
    const set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    }) as Mock & Parameters<typeof createScheduleSlice>[0];
    const get = vi.fn(() => ({ ...state, ...slice })) as unknown as Parameters<
      typeof createScheduleSlice
    >[1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createScheduleSlice(set, get, {} as any);
  });
  afterEach(() => vi.useRealTimers());

  it('spins until the refresh answers', async () => {
    let done!: () => void;
    refresh.mockReturnValue(new Promise<void>((r) => (done = r)));
    expect(slice.scheduleRefreshing).toBe(false);
    slice.triggerScheduleRefresh();
    expect(slice.scheduleRefreshing).toBe(true);
    done();
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.scheduleRefreshing).toBe(false);
  });

  it('stops spinning when the refresh fails, and says why locally', async () => {
    refresh.mockRejectedValue(new Error('boom'));
    slice.triggerScheduleRefresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.scheduleRefreshing).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      'ScheduleSlice.triggerScheduleRefresh',
      expect.any(Error)
    );
  });

  it('gives up after 15s if the refresh never answers', async () => {
    refresh.mockReturnValue(new Promise(() => {}));
    slice.triggerScheduleRefresh();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(slice.scheduleRefreshing).toBe(false);
  });

  it('does not start a second refresh while one is running', () => {
    refresh.mockReturnValue(new Promise(() => {}));
    slice.triggerScheduleRefresh();
    slice.triggerScheduleRefresh();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a late answer from a timed-out refresh does not end the next one', async () => {
    // First request never answers in time: the 15s backstop releases the flag.
    let lateFirst!: () => void;
    refresh.mockReturnValueOnce(new Promise<void>((r) => (lateFirst = r)));
    slice.triggerScheduleRefresh();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(slice.scheduleRefreshing).toBe(false);
    // A second one starts, and the first finally answers while it runs.
    refresh.mockReturnValueOnce(new Promise(() => {}));
    slice.triggerScheduleRefresh();
    expect(slice.scheduleRefreshing).toBe(true);
    lateFirst();
    await vi.advanceTimersByTimeAsync(0);
    expect(slice.scheduleRefreshing).toBe(true);
  });

  it("the first refresh's backstop does not end a later one either", async () => {
    refresh.mockResolvedValueOnce(undefined);
    slice.triggerScheduleRefresh();
    await vi.advanceTimersByTimeAsync(0);
    refresh.mockReturnValueOnce(new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(10_000);
    slice.triggerScheduleRefresh();
    // The first run's 15s timer fires 5s into the second run.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(slice.scheduleRefreshing).toBe(true);
  });
});
