import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchUsageStats } from '../usageStats';

const json = {
  today: 86,
  d7: 420,
  d30: 426,
  daily: [
    { day: '2026-09-14', active: 330, new: 283, returning: 47 },
    { day: '2026-09-15', active: 86, new: 21, returning: 65 },
  ],
  by_platform: [
    { key: 'ios', devices: 349 },
    { key: 'unknown', devices: 7 },
  ],
  by_faculty: [
    { key: 'PEF', devices: 224 },
    { key: 'ICV', devices: -1 },
  ],
  day: {
    day: '2026-09-15',
    active: 86,
    new: 21,
    returning: 65,
    by_platform: [{ key: 'ios', devices: 77 }],
  },
};

describe('fetchUsageStats', () => {
  it('maps the json to camelCase and keeps -1 as the suppression marker', async () => {
    rpc.mockResolvedValue({ data: json, error: null });

    expect(await fetchUsageStats(30)).toEqual({
      today: 86,
      d7: 420,
      d30: 426,
      daily: [
        { day: '2026-09-14', active: 330, newDevices: 283, returningDevices: 47 },
        { day: '2026-09-15', active: 86, newDevices: 21, returningDevices: 65 },
      ],
      byPlatform: [
        { key: 'ios', devices: 349 },
        { key: 'unknown', devices: 7 },
      ],
      byFaculty: [
        { key: 'PEF', devices: 224 },
        { key: 'ICV', devices: -1 },
      ],
      day: {
        day: '2026-09-15',
        active: 86,
        newDevices: 21,
        returningDevices: 65,
        byPlatform: [{ key: 'ios', devices: 77 }],
      },
    });
  });

  // The RPC defaults p_day, and sending an explicit null would be a third
  // shape for PostgREST to dispatch on. Omit it entirely when no day is picked.
  it('omits p_day unless a day is picked', async () => {
    rpc.mockResolvedValue({ data: json, error: null });

    await fetchUsageStats(30);
    expect(rpc).toHaveBeenLastCalledWith('usage_stats', { p_days: 30 });

    await fetchUsageStats(30, '2026-09-14');
    expect(rpc).toHaveBeenLastCalledWith('usage_stats', { p_days: 30, p_day: '2026-09-14' });
  });

  // A window with no rows at all still has to render: the panel distinguishes
  // "no data" from "the call failed", and only the second is an alert.
  it('accepts an empty window and a null day', async () => {
    rpc.mockResolvedValue({
      data: { ...json, daily: [], by_platform: [], by_faculty: [], day: null },
      error: null,
    });

    const stats = await fetchUsageStats(30);
    expect(stats?.daily).toEqual([]);
    expect(stats?.day).toBeNull();
  });

  it('returns null on error or malformed json', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await fetchUsageStats(30)).toBeNull();
    rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    expect(await fetchUsageStats(30)).toBeNull();
  });
});
