import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

// Saving and hiding a society from the admin console. Split from
// createSocietiesSlice.test.ts (seed, cache, fetch) to keep both short.

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
import { logoPublicUrl, rowToSociety } from '../../../api/societies';

const makeStore = () =>
  create<SocietiesSlice>()((...a) =>
    createSocietiesSlice(...(a as Parameters<typeof createSocietiesSlice>))
  );

const logo = new Blob([new Uint8Array([1])], { type: 'image/png' });
const input = {
  id: 'kino',
  name: 'Kino',
  shortName: 'KINO',
  color: '#123456',
  facultyKey: 'zf' as const,
  autoFollowFaculty: false,
  instagram: null,
};
const OLD_PATH = 'supef/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png';
const NEW_PATH = 'supef/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png';

beforeEach(() => {
  calls.length = 0;
  for (const m of [uploadSocietyLogo, insertSociety, updateSociety, removeSocietyLogo])
    m.mockReset();
});

describe('saveSociety', () => {
  it('refuses a new society without a logo, before touching the network', async () => {
    expect(await makeStore().getState().saveSociety(input, null, true)).toEqual({
      error: 'logo_required',
    });
    expect(calls).toEqual([]);
  });

  it('inserts nothing when the upload fails', async () => {
    uploadSocietyLogo.mockResolvedValue(null);
    expect(await makeStore().getState().saveSociety(input, logo, true)).toEqual({
      error: 'upload_failed',
    });
    expect(calls).toEqual(['upload']);
  });

  it('uploads, then inserts, then shows the society', async () => {
    uploadSocietyLogo.mockResolvedValue('kino/cccccccccccccccccccccccccccccccc.png');
    insertSociety.mockResolvedValue({ ...BUNDLED_SOCIETIES.zf!, ...input, glyph: 'KINO' });
    const store = makeStore();
    expect(await store.getState().saveSociety(input, logo, true)).toEqual({});
    expect(calls).toEqual(['upload', 'insert']);
    expect(store.getState().societies.kino!.name).toBe('Kino');
  });

  it('reports a failed insert', async () => {
    uploadSocietyLogo.mockResolvedValue('kino/cccccccccccccccccccccccccccccccc.png');
    insertSociety.mockResolvedValue(null);
    expect(await makeStore().getState().saveSociety(input, logo, true)).toEqual({
      error: 'save_failed',
    });
  });

  it('deletes a replaced logo only after the row points at the new one', async () => {
    const store = makeStore();
    store.setState({
      societies: {
        ...BUNDLED_SOCIETIES,
        supef: { ...BUNDLED_SOCIETIES.supef!, logo: logoPublicUrl(OLD_PATH) },
      },
    });
    uploadSocietyLogo.mockResolvedValue(NEW_PATH);
    updateSociety.mockResolvedValue({ ...BUNDLED_SOCIETIES.supef!, logo: logoPublicUrl(NEW_PATH) });
    const edit = { ...input, id: 'supef', facultyKey: 'pef' as const };
    expect(await store.getState().saveSociety(edit, logo, false)).toEqual({});
    expect(calls).toEqual(['upload', 'update', 'remove']);
    expect(removeSocietyLogo).toHaveBeenCalledWith(OLD_PATH);
  });

  it('keeps the old logo when the update fails', async () => {
    const store = makeStore();
    store.setState({
      societies: {
        ...BUNDLED_SOCIETIES,
        supef: { ...BUNDLED_SOCIETIES.supef!, logo: logoPublicUrl(OLD_PATH) },
      },
    });
    uploadSocietyLogo.mockResolvedValue(NEW_PATH);
    updateSociety.mockResolvedValue(null);
    await store.getState().saveSociety({ ...input, id: 'supef' }, logo, false);
    expect(removeSocietyLogo).not.toHaveBeenCalled();
  });

  it('edits without a new logo and leaves logo_path alone', async () => {
    updateSociety.mockResolvedValue({ ...BUNDLED_SOCIETIES.zf!, name: 'ZF nový' });
    const store = makeStore();
    await store.getState().saveSociety({ ...input, id: 'zf', name: 'ZF nový' }, null, false);
    expect(calls).toEqual(['update']);
    expect(updateSociety.mock.calls[0]![1]).not.toHaveProperty('logo_path');
    expect(store.getState().societies.zf!.name).toBe('ZF nový');
  });
});

describe('saveSociety: instagram', () => {
  const zfRow = {
    id: 'zf',
    name: 'ZF',
    short_name: 'ZF',
    color: '#8c0a00',
    faculty_key: 'zf',
    auto_follow_faculty: true,
    audience_label: null,
    logo_path: null,
    sort_order: 10,
    is_active: true,
    kind: 'society',
    audience: null,
    mark_light_path: null,
    mark_dark_path: null,
    instagram: null as string | null,
  };
  const zfEdit = { ...input, id: 'zf', facultyKey: 'zf' as const };
  const withHandle = () => {
    const store = makeStore();
    store.setState({
      societies: { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, instagram: 'zfig' } },
    });
    return store;
  };

  // Through the real rowToSociety: the store merges the saved row over the
  // cached society, so a cleared handle has to override the old one there.
  it('clearing the handle reaches the store', async () => {
    updateSociety.mockResolvedValue(rowToSociety({ ...zfRow, instagram: null }));
    const store = withHandle();
    expect(await store.getState().saveSociety({ ...zfEdit, instagram: null }, null, false)).toEqual(
      {}
    );
    expect(updateSociety.mock.calls[0]![1]).toMatchObject({ instagram: null });
    expect(store.getState().societies.zf!.instagram).toBeUndefined();
  });

  it('an input without instagram leaves the column out of the update', async () => {
    updateSociety.mockResolvedValue(rowToSociety({ ...zfRow, instagram: 'zfig' }));
    const { instagram: _omit, ...noInstagram } = zfEdit;
    const store = withHandle();
    await store.getState().saveSociety(noInstagram, null, false);
    expect(updateSociety.mock.calls[0]![1]).not.toHaveProperty('instagram');
    // And the store keeps the untouched handle the database kept.
    expect(store.getState().societies.zf!.instagram).toBe('zfig');
  });

  it('a new handle is written', async () => {
    updateSociety.mockResolvedValue(rowToSociety({ ...zfRow, instagram: 'novy' }));
    const store = withHandle();
    await store.getState().saveSociety({ ...zfEdit, instagram: 'novy' }, null, false);
    expect(updateSociety.mock.calls[0]![1]).toMatchObject({ instagram: 'novy' });
    expect(store.getState().societies.zf!.instagram).toBe('novy');
  });
});

describe('setSocietyActive', () => {
  it('hides a society', async () => {
    updateSociety.mockResolvedValue({ ...BUNDLED_SOCIETIES.zf!, isActive: false });
    const store = makeStore();
    expect(await store.getState().setSocietyActive('zf', false)).toBe(true);
    expect(updateSociety).toHaveBeenCalledWith('zf', { is_active: false });
    expect(store.getState().societies.zf!.isActive).toBe(false);
  });

  it('reports a failure and changes nothing', async () => {
    updateSociety.mockResolvedValue(null);
    const store = makeStore();
    expect(await store.getState().setSocietyActive('zf', false)).toBe(false);
    expect(store.getState().societies.zf!.isActive).toBe(true);
  });
});
