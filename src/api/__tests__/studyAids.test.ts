import { describe, it, expect, vi, beforeEach } from 'vitest';

const { select, adminSelect, update, eq, returning } = vi.hoisted(() => ({
  select: vi.fn<(...a: unknown[]) => Promise<{ data: unknown; error: unknown }>>(),
  adminSelect: vi.fn<(...a: unknown[]) => unknown>(),
  update: vi.fn<(...a: unknown[]) => unknown>(),
  eq: vi.fn<(...a: unknown[]) => unknown>(),
  // What the update answers with: the rows it changed.
  returning: vi.fn<(...a: unknown[]) => Promise<{ data: unknown; error: unknown }>>(),
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
        return {
          eq: (...b: unknown[]) => {
            eq(...b);
            return { select: (...c: unknown[]) => returning(...c) };
          },
        };
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
  beforeEach(() => {
    vi.clearAllMocks();
    returning.mockResolvedValue({ data: [{ id: 'mendelu-app' }], error: null });
  });

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
    expect(returning).toHaveBeenCalledWith('id');
  });

  it('answers false when the write is refused', async () => {
    returning.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    expect(await saveAdminStudyAids('mendelu-app', { audience: ['af'], isActive: true })).toBe(
      false
    );
  });

  // RLS does not error on an update it hides the row from: it changes nothing
  // and answers success. A console whose session lost its role must not say Saved.
  it('answers false when the update changed no row', async () => {
    returning.mockResolvedValueOnce({ data: [], error: null });
    expect(await saveAdminStudyAids('mendelu-app', { audience: ['af'], isActive: true })).toBe(
      false
    );
  });
});
