import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';

const fetchSocieties = vi.fn();
vi.mock('../../../api/societies', () => ({
  fetchSocieties: () => fetchSocieties(),
  SOCIETY_LOGO_BUCKET: 'society-logos',
}));
const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));

import { createSocietiesSlice, type SocietiesSlice } from '../createSocietiesSlice';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

const makeStore = () =>
  create<SocietiesSlice>()((...a) =>
    createSocietiesSlice(...(a as Parameters<typeof createSocietiesSlice>))
  );

const fresh = { ...BUNDLED_SOCIETIES.esn!, name: 'ESN (fresh)' };
const newcomer = { ...BUNDLED_SOCIETIES.zf!, id: 'kino', name: 'Kino' };

beforeEach(() => {
  idb.clear();
  fetchSocieties.mockReset();
});

describe('createSocietiesSlice', () => {
  it('starts from the bundled seed, so nothing is ever unbranded', () => {
    expect(makeStore().getState().societies.supef!.shortName).toBe('SUPEF');
  });

  it('replaces the seed with the fetched catalog and caches it', async () => {
    fetchSocieties.mockResolvedValue([fresh, newcomer]);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(Object.keys(store.getState().societies)).toEqual(['esn', 'kino']);
    expect(idb.get('societies_catalog')).toEqual([fresh, newcomer]);
  });

  it('reads the cache before the network, and keeps it when the fetch fails', async () => {
    idb.set('societies_catalog', [newcomer]);
    fetchSocieties.mockResolvedValue(null);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.kino!.name).toBe('Kino');
  });

  it('ignores an empty fetch rather than wiping the catalog', async () => {
    fetchSocieties.mockResolvedValue([]);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.supef).toBeDefined();
  });

  it('ignores a corrupt cache entry', async () => {
    idb.set('societies_catalog', [{ nope: true }]);
    fetchSocieties.mockResolvedValue(null);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.supef).toBeDefined();
  });

  it('putSociety upserts into state and cache', async () => {
    const store = makeStore();
    await store.getState().putSociety(newcomer);
    expect(store.getState().societies.kino).toEqual(newcomer);
    expect((idb.get('societies_catalog') as { id: string }[]).some((s) => s.id === 'kino')).toBe(
      true
    );
  });
});
