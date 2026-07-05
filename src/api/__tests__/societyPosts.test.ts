import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertSingle = vi.fn();
const insert = vi.fn(() => ({ select: () => ({ single: () => insertSingle() }) }));
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { from: () => ({ insert }) },
}));

import { toRow, createPost, type PostInput } from '../societyPosts';

const base: PostInput = {
  title: 'Party', body: 'come', category: 'party', date: '2026-07-10',
  venueKind: 'campus', roomCode: 'Q01',
};

describe('societyPosts.toRow', () => {
  it('maps camelCase input to snake_case row with association + created_by', () => {
    const row = toRow(base, 'supef', 'supef@societies.reis.invalid');
    expect(row).toMatchObject({
      association_id: 'supef', created_by: 'supef@societies.reis.invalid',
      title: 'Party', body: 'come', category: 'party', date: '2026-07-10',
      venue_kind: 'campus', room_code: 'Q01',
      end_date: null, time: null, coord_lng: null, coord_lat: null, location: null, url: null, visible_from: null,
    });
  });
});

describe('societyPosts.createPost', () => {
  beforeEach(() => { insert.mockClear(); insertSingle.mockReset(); });
  it('returns the new id on success', async () => {
    insertSingle.mockResolvedValue({ data: { id: 'abc' }, error: null });
    const res = await createPost(base, 'supef', 'supef@societies.reis.invalid');
    expect(res.id).toBe('abc');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ association_id: 'supef', venue_kind: 'campus' }));
  });
  it('returns an error on failure', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const res = await createPost(base, 'supef', 'x');
    expect(res.error).toBe('denied');
  });
  it('returns an error (does not throw) when the insert resolves with no data and no error', async () => {
    insertSingle.mockResolvedValue({ data: null, error: null });
    expect((await createPost(base, 'supef', 'x')).error).toBeDefined();
  });
});
