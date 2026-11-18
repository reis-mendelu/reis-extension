import { describe, it, expect, vi, beforeEach } from 'vitest';

const { select, adminSelect, update, eq } = vi.hoisted(() => ({
  select: vi.fn<(...a: unknown[]) => Promise<{ data: unknown; error: unknown }>>(),
  adminSelect: vi.fn<(...a: unknown[]) => unknown>(),
  update: vi.fn<(...a: unknown[]) => unknown>(),
  eq: vi.fn<(...a: unknown[]) => Promise<{ error: unknown }>>(async () => ({ error: null })),
}));
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: () => ({ select: (...a: unknown[]) => select(...a) }) },
}));
vi.mock('../../services/admin/authClient', () => ({
  adminAuthClient: {
    from: () => ({
      select: (...a: unknown[]) => adminSelect(...a),
      update: (...a: unknown[]) => {
        update(...a);
        return { eq: (...b: unknown[]) => eq(...b) };
      },
    }),
  },
}));
vi.mock('../../utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchStudyAids } from '../studyAids';
import { fetchAdminStudyAids, saveAdminStudyAids } from '../adminStudyAids';

describe('fetchStudyAids (what students read)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the rows RLS lets through to id -> audience', async () => {
    select.mockResolvedValue({
      data: [{ id: 'mendelu-app', audience: ['af:B-ATE', 'af:N-PTE'] }],
      error: null,
    });
    expect(await fetchStudyAids()).toEqual({ 'mendelu-app': ['af:B-ATE', 'af:N-PTE'] });
    expect(select).toHaveBeenCalledWith('id, audience');
  });

  it('skips a malformed row without hiding the others', async () => {
    select.mockResolvedValue({
      data: [{ id: 'bad', audience: 'af' }, { id: 'ok', audience: ['af'] }, { nope: 1 }],
      error: null,
    });
    expect(await fetchStudyAids()).toEqual({ ok: ['af'] });
  });

  // Not known is not "nobody": the store keeps what it had (the cache), and a
  // build that runs before the migration simply shows no link.
  it('answers null, not {}, when the read fails', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });
    expect(await fetchStudyAids()).toBeNull();
  });
});

describe('the console side (reis_admin only, by RLS)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads every row, switched off ones included, as camelCase', async () => {
    adminSelect.mockReturnValue({
      order: async () => ({
        data: [{ id: 'mendelu-app', audience: ['af:B-ATE'], is_active: false }],
        error: null,
      }),
    });
    expect(await fetchAdminStudyAids()).toEqual([
      { id: 'mendelu-app', audience: ['af:B-ATE'], isActive: false },
    ]);
    expect(adminSelect).toHaveBeenCalledWith('id, audience, is_active');
  });

  it('answers null when the read fails', async () => {
    adminSelect.mockReturnValue({ order: async () => ({ data: null, error: { message: 'x' } }) });
    expect(await fetchAdminStudyAids()).toBeNull();
  });

  it('writes the audience and the switch to one row', async () => {
    expect(
      await saveAdminStudyAids('mendelu-app', { audience: ['af:B-ATE'], isActive: true })
    ).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ audience: ['af:B-ATE'], is_active: true })
    );
    expect(eq).toHaveBeenCalledWith('id', 'mendelu-app');
  });

  it('answers false when the write is refused', async () => {
    eq.mockResolvedValueOnce({ error: { message: 'denied' } });
    expect(await saveAdminStudyAids('mendelu-app', { audience: ['af'], isActive: true })).toBe(
      false
    );
  });
});
