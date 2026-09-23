import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The calendar's pull refreshes the timetable and nothing else.
 *
 * It used to run the whole `user` sync: 109 IS requests and ~30s measured
 * against a real account, of which the schedule was 4 requests and 3s. The
 * rest — 57 file folders, 19 syllabi, classmates — is nothing the calendar
 * shows, and the spinner waited for all of it.
 *
 * Same three shapes as the full sync's schedule path (syncScheduleEmpty.test):
 *   non-empty → data + arrival, and the TTL stamp restarts
 *   []        → arrival only, cache untouched
 *   null      → nothing at all
 */

const schedule = vi.fn();

vi.mock('../dataFetchers', () => ({
  fetchFullSemesterSchedule: (...a: unknown[]) => schedule(...a),
}));
vi.mock('../iframeManager', () => ({ sendToIframe: vi.fn() }));
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ studium: 'st1', obdobi: 'ob1' }),
}));
vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => {}) },
}));

const LESSONS = [{ id: 'l1' }];

/** Fresh module registry per test — cachedData and the TTL stamps are module state. */
async function load() {
  vi.resetModules();
  const sync = await import('../syncService');
  const ttl = await import('../syncTtl');
  const { sendToIframe } = await import('../iframeManager');
  const posted = () =>
    vi
      .mocked(sendToIframe)
      .mock.calls.map((c) => c[0] as unknown as { type: string; data: Record<string, unknown> })
      .filter((m) => m.type === 'REIS_SYNC_UPDATE');
  return { ...sync, ...ttl, posted };
}

describe('refreshSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes a real timetable as data and as arrival, without claiming a sync', async () => {
    schedule.mockResolvedValue(LESSONS);
    const { refreshSchedule, posted, isFresh, TTL } = await load();
    await refreshSchedule();

    const [msg, ...rest] = posted();
    expect(rest).toHaveLength(0);
    expect(msg!.data.schedule).toEqual(LESSONS);
    expect(msg!.data.loaded).toEqual(['schedule']);
    expect(msg!.data.isSyncing).toBe(false);
    // The next scheduled run need not fetch it again.
    expect(isFresh('schedule', TTL.SEMESTER)).toBe(true);
  });

  it('pushes only the arrival for an empty read, never an empty list as data', async () => {
    schedule.mockResolvedValue([]);
    const { refreshSchedule, posted } = await load();
    await refreshSchedule();

    const [msg] = posted();
    expect(msg!.data.schedule).toBeUndefined();
    expect(msg!.data.loaded).toEqual(['schedule']);
  });

  it('pushes nothing when the fetch fails', async () => {
    schedule.mockResolvedValue(null);
    const { refreshSchedule, posted } = await load();
    await refreshSchedule();
    expect(posted()).toHaveLength(0);
  });

  it('fetches the schedule and nothing else', async () => {
    schedule.mockResolvedValue(LESSONS);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { refreshSchedule } = await load();
    await refreshSchedule();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
