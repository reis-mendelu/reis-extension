import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchUsageStats = vi.hoisted(() => vi.fn());
vi.mock('../../../api/usageStats', () => ({ fetchUsageStats }));

import { useAppStore } from '../../useAppStore';

const stats = {
  today: 86,
  d7: 420,
  d30: 426,
  daily: [{ day: '2026-09-15', active: 86, newDevices: 21, returningDevices: 65 }],
  byPlatform: [],
  byFaculty: [],
  day: { day: '2026-09-15', active: 86, newDevices: 21, returningDevices: 65, byPlatform: [] },
};

describe('createAdminStatsSlice', () => {
  beforeEach(() => {
    fetchUsageStats.mockReset().mockResolvedValue(stats);
    useAppStore.setState({
      adminStats: null,
      adminStatsDay: null,
      adminStatsRequestId: 0,
    } as never);
  });

  it('asks for today when no day is picked', async () => {
    await useAppStore.getState().loadAdminStats();

    expect(fetchUsageStats).toHaveBeenCalledWith(30, undefined);
    expect(useAppStore.getState().adminStats).toEqual(stats);
  });

  it('picking a day keeps it and refetches for it', async () => {
    await useAppStore.getState().selectAdminStatsDay('2026-09-14');

    expect(fetchUsageStats).toHaveBeenLastCalledWith(30, '2026-09-14');
    expect(useAppStore.getState().adminStatsDay).toBe('2026-09-14');
  });

  // Two quick clicks on the chart race. Without a guard the SLOWER response
  // wins simply by landing last, and the panel then shows one day's numbers
  // under another day's heading — the drill-down silently lying about which
  // day it is describing.
  it('lets the newest request win, however the responses interleave', async () => {
    const slow = { ...stats, today: 111 };
    const fast = { ...stats, today: 222 };
    let releaseSlow: (v: unknown) => void = () => {};
    fetchUsageStats
      .mockImplementationOnce(() => new Promise((r) => (releaseSlow = r)))
      .mockResolvedValueOnce(fast);

    const first = useAppStore.getState().selectAdminStatsDay('2026-09-13');
    const second = useAppStore.getState().selectAdminStatsDay('2026-09-14');
    await second;
    releaseSlow(slow);
    await first;

    expect(useAppStore.getState().adminStats?.today).toBe(222);
    expect(useAppStore.getState().adminStatsDay).toBe('2026-09-14');
    expect(useAppStore.getState().adminStatsLoading).toBe(false);
  });

  // A failed refetch used to be indistinguishable from a successful empty one:
  // the old slice spread `...(stats ? {...} : {})`, silently keeping the stale
  // payload on screen. Keeping it is right, but the day must not move to one
  // the displayed payload never described.
  it('does not move the selected day when the refetch fails', async () => {
    await useAppStore.getState().loadAdminStats();
    fetchUsageStats.mockResolvedValue(null);

    await useAppStore.getState().selectAdminStatsDay('2026-09-14');

    expect(useAppStore.getState().adminStatsDay).toBeNull();
    expect(useAppStore.getState().adminStats).toEqual(stats);
    expect(useAppStore.getState().adminStatsLoading).toBe(false);
  });
});
