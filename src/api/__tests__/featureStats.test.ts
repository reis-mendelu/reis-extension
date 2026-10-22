import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
vi.mock('@/utils/reportError', () => ({ logError: vi.fn() }));

import { fetchFeatureStats } from '../featureStats';

const BASE = { by_feature: [], daily: [], top_events: [], event_daily: [] };

describe('fetchFeatureStats — event_reach', () => {
  beforeEach(() => rpc.mockReset());

  it('maps each event row to Novinky views, clicks and map opens', async () => {
    rpc.mockResolvedValue({
      data: {
        ...BASE,
        event_reach: [
          {
            id: 'e1',
            title: 'Ples',
            association_id: 'supef',
            kind: 'event',
            view_count: 5253,
            click_count: 247,
            map_views: 199,
          },
        ],
      },
      error: null,
    });

    const stats = await fetchFeatureStats(30);

    expect(stats?.eventReach).toEqual([
      {
        id: 'e1',
        title: 'Ples',
        societyId: 'supef',
        kind: 'event',
        views: 5253,
        clicks: 247,
        mapViews: 199,
      },
    ]);
  });

  // The migration lands at release, not on merge. Until then prod answers
  // without the key, and the whole feature block must not vanish with it.
  it('still parses an answer from a database that predates event_reach', async () => {
    rpc.mockResolvedValue({ data: BASE, error: null });

    const stats = await fetchFeatureStats(30);

    expect(stats).not.toBeNull();
    expect(stats?.eventReach).toEqual([]);
  });
});
