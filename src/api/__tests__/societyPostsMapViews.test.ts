import { describe, it, expect, vi, beforeEach } from 'vitest';

// The society's own session reads its posts with `.from().select().eq().order()`
// and, beside it, the map opens through an owner-scoped RPC: event_map_views has
// RLS on and no read policy, so a society cannot select from it directly.
const order = vi.fn();
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: {
    from: () => ({ select: () => ({ eq: () => ({ order }) }) }),
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false, devSocietyStore: {} }));
vi.mock('@/utils/reportError', () => ({ logError: vi.fn() }));

import { listMyPosts } from '../societyPosts';

const post = (id: string) => ({ id, association_id: 'mendelu', title: id, view_count: 0 });

describe('listMyPosts — map opens', () => {
  beforeEach(() => {
    order.mockReset();
    rpc.mockReset();
  });

  it('puts each event its map opens, asked for the active society', async () => {
    order.mockResolvedValue({ data: [post('a'), post('b')], error: null });
    rpc.mockResolvedValue({
      data: [
        { id: 'a', map_views: 83 },
        { id: 'b', map_views: 0 },
      ],
      error: null,
    });

    const rows = await listMyPosts('mendelu');

    expect(rpc).toHaveBeenCalledWith('society_event_map_views', { p_association_id: 'mendelu' });
    expect(rows?.map((r) => [r.id, r.map_views])).toEqual([
      ['a', 83],
      ['b', 0],
    ]);
  });

  // The migration lands at release, not on merge. Until then prod answers the
  // RPC with an error, and the society's list must still load, without the figure.
  it('still lists the posts, with no map figure, when the RPC fails', async () => {
    order.mockResolvedValue({ data: [post('a')], error: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'function does not exist' } });

    const rows = await listMyPosts('mendelu');

    expect(rows).toHaveLength(1);
    expect(rows?.[0]).not.toHaveProperty('map_views');
  });

  it('still lists the posts when the RPC throws or answers a shape it does not know', async () => {
    order.mockResolvedValue({ data: [post('a')], error: null });
    rpc.mockRejectedValueOnce(new Error('offline'));
    expect((await listMyPosts('mendelu'))?.[0]).not.toHaveProperty('map_views');

    rpc.mockResolvedValueOnce({ data: [{ id: 'a', map_views: 'many' }], error: null });
    expect((await listMyPosts('mendelu'))?.[0]).not.toHaveProperty('map_views');
  });

  it('leaves an event the RPC did not name without a figure, not at 0', async () => {
    order.mockResolvedValue({ data: [post('a'), post('new')], error: null });
    rpc.mockResolvedValue({ data: [{ id: 'a', map_views: 3 }], error: null });

    const rows = await listMyPosts('mendelu');

    expect(rows?.[0]?.map_views).toBe(3);
    expect(rows?.[1]).not.toHaveProperty('map_views');
  });

  // A failed read of the posts is still null (not []), the rule listMyPosts keeps.
  it('returns null when the posts themselves cannot be read', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await listMyPosts('mendelu')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
