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

  // Boot and a resume (or a publish's reload) can both ask while one request
  // is still out. They share it rather than sending a second catalog request.
  it('shares one request between overlapping loads', async () => {
    let resolve!: (v: unknown) => void;
    fetchSocieties.mockReturnValue(new Promise((r) => (resolve = r)));
    const store = makeStore();
    const first = store.getState().loadSocieties();
    const second = store.getState().loadSocieties();
    // The cache read is awaited first; let both calls reach the network step.
    await new Promise((r) => setTimeout(r, 0));
    resolve([fresh]);
    await Promise.all([first, second]);
    expect(fetchSocieties).toHaveBeenCalledTimes(1);
    // Done means done: the next load asks again.
    fetchSocieties.mockResolvedValue([fresh]);
    await store.getState().loadSocieties();
    expect(fetchSocieties).toHaveBeenCalledTimes(2);
  });

  // An admin save lands while a catalog load started before it is still out.
  // That load's snapshot predates the save: it must not roll the save back, and
  // a reload asked for after the save must not join it.
  it('a load that started before a save neither undoes it nor is reused after it', async () => {
    let resolveOld!: (v: unknown) => void;
    fetchSocieties.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    const store = makeStore();
    const old = store.getState().loadSocieties();
    await new Promise((r) => setTimeout(r, 0));

    await store.getState().putSociety(newcomer);
    fetchSocieties.mockResolvedValueOnce([fresh, newcomer]);
    const after = store.getState().loadSocieties();

    resolveOld([fresh]);
    await Promise.all([old, after]);
    expect(fetchSocieties).toHaveBeenCalledTimes(2);
    expect(store.getState().societies.kino!.name).toBe('Kino');
  });

  it('an old load finishing last does not undo a save', async () => {
    let resolveOld!: (v: unknown) => void;
    fetchSocieties.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    const store = makeStore();
    const old = store.getState().loadSocieties();
    await new Promise((r) => setTimeout(r, 0));
    await store.getState().putSociety(newcomer);

    resolveOld([fresh]);
    await old;
    expect(store.getState().societies.kino!.name).toBe('Kino');
    expect((idb.get('societies_catalog') as { id: string }[]).map((s) => s.id)).toContain('kino');
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

  it('rejects a cached record missing a field the UI reads', async () => {
    // A cache from an older shape must not replace the seed: SocietyLogo reads
    // glyph.length and listedSocieties sorts on sortOrder.
    const { glyph: _g, ...noGlyph } = newcomer;
    idb.set('societies_catalog', [noGlyph]);
    fetchSocieties.mockResolvedValue(null);
    const store = makeStore();
    await store.getState().loadSocieties();
    expect(store.getState().societies.kino).toBeUndefined();
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
