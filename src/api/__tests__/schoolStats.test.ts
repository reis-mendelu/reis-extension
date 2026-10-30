import { describe, it, expect, vi, beforeEach } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchSchoolStats } from '../schoolStats';

// The shape school_stats_unchecked() returns (supabase/tests/school_stats.test.sql).
const RAW = {
  week_from: '2026-10-19',
  week_to: '2026-10-25',
  regulars: 1990,
  regulars_phone: 1786,
  regulars_by_faculty: [
    { key: 'PEF', n: 1325 },
    { key: 'ZF', n: -1 },
  ],
  eduroam_since: '2026-09-23',
  eduroam_wifi: 455,
  eduroam_profile: 93,
  eduroam_by_faculty: [{ key: 'PEF', n: 236 }],
  eduroam_by_week: [{ key: '2026-09-28', n: 210 }],
  events: { posts: 63, views: 11216, clicks: 850, map_views: 609 },
  notices: [
    {
      id: 'q1',
      prompt: 'reIS je teď na Google Play',
      starts_at: '2026-10-24T21:43:08+00:00',
      ends_at: '2026-11-07T21:43:08+00:00',
      seen: 711,
    },
  ],
};

describe('fetchSchoolStats', () => {
  beforeEach(() => rpc.mockReset());

  it('maps the json to camelCase, groups to the StatsBars shape', async () => {
    rpc.mockResolvedValue({ data: RAW, error: null });

    const got = await fetchSchoolStats();

    expect(rpc).toHaveBeenLastCalledWith('school_stats');
    expect(got).toEqual({
      weekFrom: '2026-10-19',
      weekTo: '2026-10-25',
      regulars: 1990,
      regularsPhone: 1786,
      regularsByFaculty: [
        { key: 'PEF', devices: 1325 },
        { key: 'ZF', devices: -1 },
      ],
      eduroamSince: '2026-09-23',
      eduroamWifi: 455,
      eduroamProfile: 93,
      eduroamByFaculty: [{ key: 'PEF', devices: 236 }],
      eduroamByWeek: [{ key: '2026-09-28', devices: 210 }],
      events: { posts: 63, views: 11216, clicks: 850, mapViews: 609 },
      notices: [
        {
          id: 'q1',
          prompt: 'reIS je teď na Google Play',
          startsAt: '2026-10-24T21:43:08+00:00',
          endsAt: '2026-11-07T21:43:08+00:00',
          seen: 711,
        },
      ],
    });
  });

  it('accepts a database with no eduroam setups yet', async () => {
    rpc.mockResolvedValue({ data: { ...RAW, eduroam_since: null }, error: null });
    expect((await fetchSchoolStats())?.eduroamSince).toBeNull();
  });

  it('returns null on error or malformed json', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await fetchSchoolStats()).toBeNull();
    rpc.mockResolvedValue({ data: { regulars: 'many' }, error: null });
    expect(await fetchSchoolStats()).toBeNull();
  });
});
