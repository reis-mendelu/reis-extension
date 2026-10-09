import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

// Saving a partner from the admin console (spec 2026-10-09): kind, audience and
// the two colour marks. Same mocks as createSocietiesSlice.save.test.ts.

vi.mock('../../../api/societies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/societies')>()),
  fetchSocieties: vi.fn(async () => null),
}));
vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) },
}));
vi.mock('../../../utils/societies/encodeSocietyLogo', () => ({
  encodeSocietyLogo: vi.fn(async (b: Blob) => b),
}));
vi.mock('../../../utils/societies/encodePartnerMark', () => ({
  encodePartnerMark: vi.fn(async (b: Blob) => b),
}));
const calls: string[] = [];
const uploadSocietyLogo = vi.fn();
const insertSociety = vi.fn();
const updateSociety = vi.fn();
const removeSocietyLogo = vi.fn();
vi.mock('../../../api/societiesAdmin', () => ({
  uploadSocietyLogo: (...a: unknown[]) => (calls.push('upload'), uploadSocietyLogo(...a)),
  insertSociety: (...a: unknown[]) => (calls.push('insert'), insertSociety(...a)),
  updateSociety: (...a: unknown[]) => (calls.push('update'), updateSociety(...a)),
  removeSocietyLogo: (...a: unknown[]) => (calls.push('remove'), removeSocietyLogo(...a)),
}));

import { createSocietiesSlice, type SocietiesSlice } from '../createSocietiesSlice';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

const makeStore = () =>
  create<SocietiesSlice>()((...a) =>
    createSocietiesSlice(...(a as Parameters<typeof createSocietiesSlice>))
  );

const KPMG = {
  id: 'kpmg',
  name: 'KPMG',
  shortName: 'KPMG',
  color: '#00338d',
  facultyKey: 'frrms' as const,
  autoFollowFaculty: false,
  kind: 'partner' as const,
  audience: ['frrms'],
};
const KPMG_SOCIETY = { ...BUNDLED_SOCIETIES.ey!, ...KPMG, glyph: 'KPMG' };
const LIGHT = 'kpmg/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
const DARK = 'kpmg/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png';
const blob = (s: string) => new Blob([s], { type: 'image/png' });

beforeEach(() => {
  calls.length = 0;
  for (const m of [uploadSocietyLogo, insertSociety, updateSociety, removeSocietyLogo])
    m.mockReset();
});

describe('saveSociety: partner', () => {
  it('uploads both marks, then writes kind, audience and mark paths', async () => {
    uploadSocietyLogo.mockResolvedValueOnce(LIGHT).mockResolvedValueOnce(DARK);
    updateSociety.mockResolvedValue(KPMG_SOCIETY);
    const res = await makeStore()
      .getState()
      .saveSociety(KPMG, null, false, { light: blob('l'), dark: blob('d') });
    expect(res).toEqual({});
    expect(calls).toEqual(['upload', 'upload', 'update']);
    expect(updateSociety).toHaveBeenCalledWith(
      'kpmg',
      expect.objectContaining({
        kind: 'partner',
        audience: ['frrms'],
        mark_light_path: LIGHT,
        mark_dark_path: DARK,
      })
    );
  });

  it('saves nothing when a mark upload fails', async () => {
    uploadSocietyLogo.mockResolvedValueOnce(null);
    const res = await makeStore()
      .getState()
      .saveSociety(KPMG, null, false, { light: blob('l'), dark: null });
    expect(res).toEqual({ error: 'upload_failed' });
    expect(updateSociety).not.toHaveBeenCalled();
  });

  // One insert carries the row and its marks: a failed follow-up update would
  // leave a partner without marks that a retry could not re-insert.
  it('a new partner is inserted together with its marks', async () => {
    uploadSocietyLogo
      .mockResolvedValueOnce('kpmg/cccccccccccccccccccccccccccccccc.png')
      .mockResolvedValueOnce(LIGHT);
    insertSociety.mockResolvedValue(KPMG_SOCIETY);
    const res = await makeStore()
      .getState()
      .saveSociety(KPMG, blob('logo'), true, { light: blob('l'), dark: null });
    expect(res).toEqual({});
    expect(calls).toEqual(['upload', 'upload', 'insert']);
    expect(insertSociety.mock.calls[0]![0]).toMatchObject({ kind: 'partner', audience: ['frrms'] });
    expect(insertSociety.mock.calls[0]![3]).toEqual({ mark_light_path: LIGHT });
  });

  it('a plain society edit writes no partner columns', async () => {
    updateSociety.mockResolvedValue(BUNDLED_SOCIETIES.zf!);
    const { kind: _k, audience: _a, ...plain } = { ...KPMG, id: 'zf' };
    await makeStore().getState().saveSociety(plain, null, false);
    expect(updateSociety.mock.calls[0]![1]).not.toHaveProperty('kind');
    expect(updateSociety.mock.calls[0]![1]).not.toHaveProperty('mark_light_path');
  });
});
