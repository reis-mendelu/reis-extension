import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubjectZaznamnik } from '../../../types/zaznamnik';

/**
 * Where the fresh záznamník replaces the stored copy, the sync compares the two
 * first and remembers what the student has not seen yet. Real IndexedDB is not
 * the point here; a map stands in for it.
 */
const { db, failMeta } = vi.hoisted(() => ({
  db: new Map<string, unknown>(),
  // A write that touches meta fails: an interrupted save, a full disk.
  failMeta: { on: false },
}));
type Write = { store: string; key: string; value: unknown };
vi.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: {
    get: vi.fn(async (store: string, key: string) => db.get(`${store}/${key}`)),
    set: vi.fn(async (store: string, key: string, v: unknown) => {
      if (failMeta.on && store === 'meta') throw new Error('aborted');
      db.set(`${store}/${key}`, v);
    }),
    setMany: vi.fn(async (store: string, entries: [string, unknown][]) => {
      for (const [k, v] of entries) db.set(`${store}/${k}`, v);
    }),
    // One transaction: all of it lands or none of it does.
    setAcross: vi.fn(async (writes: Write[]) => {
      if (failMeta.on && writes.some((w) => w.store === 'meta')) throw new Error('aborted');
      for (const w of writes) db.set(`${w.store}/${w.key}`, w.value);
    }),
  },
}));

import { persistZaznamnikBatch, NEW_POINTS_META_KEY } from '../zaznamnikNewPoints';

function ps(first: string, sum = first): SubjectZaznamnik {
  return {
    ph: {
      sections: [
        {
          label: 'Archy ze cvičení',
          arches: [
            {
              name: 'Priebezne hodnotenie',
              empty: false,
              columns: ['IPv4-subnt-NAOPAK', 'IPv4-subnt', 'Součet'],
              values: [first, '', sum],
            },
          ],
        },
      ],
      fetchedAt: 1,
    },
    vt: { tests: [], fetchedAt: 1 },
  };
}
const EMPTY: SubjectZaznamnik = {
  ph: { sections: [], fetchedAt: 1 },
  vt: { tests: [], fetchedAt: 1 },
};

const NOW = 1_000;
const FOUND_9 = { label: 'IPv4-subnt-NAOPAK', value: '9', at: NOW };

describe('persistZaznamnikBatch', () => {
  beforeEach(() => {
    db.clear();
    failMeta.on = false;
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  it('stores the first copy and announces nothing', async () => {
    const out = await persistZaznamnikBatch({ 'EBC-PS': ps('') });
    expect(out.found).toEqual({});
    expect(db.get('zaznamnik/EBC-PS')).toEqual(ps(''));
  });

  it('finds new points against the stored copy, then stores the fresh one', async () => {
    db.set('zaznamnik/EBC-PS', ps(''));
    const out = await persistZaznamnikBatch({ 'EBC-PS': ps('9') });
    expect(out.found).toEqual({ 'EBC-PS': [FOUND_9] });
    expect(out.unseen).toEqual(out.found);
    expect(db.get('zaznamnik/EBC-PS')).toEqual(ps('9'));
    expect(db.get(`meta/${NEW_POINTS_META_KEY}`)).toEqual(out.found);
  });

  it('keeps the stored copy and stays quiet for a failed or empty fetch', async () => {
    db.set('zaznamnik/EBC-PS', ps('9'));
    const out = await persistZaznamnikBatch({ 'EBC-PS': null, 'EBC-VWA': EMPTY });
    expect(out.found).toEqual({});
    expect(db.get('zaznamnik/EBC-PS')).toEqual(ps('9'));
    expect(db.has('zaznamnik/EBC-VWA')).toBe(false);
  });

  it('adds to what is still unseen, the newer value winning', async () => {
    db.set('zaznamnik/EBC-PS', ps(''));
    db.set(`meta/${NEW_POINTS_META_KEY}`, {
      'EBC-VWA': [{ label: '2', value: '1' }],
      'EBC-PS': [{ label: 'IPv4-subnt-NAOPAK', value: '5' }],
    });
    const out = await persistZaznamnikBatch({ 'EBC-PS': ps('9') });
    expect(out.unseen).toEqual({
      'EBC-VWA': [{ label: '2', value: '1' }],
      'EBC-PS': [FOUND_9],
    });
  });

  it('two pushes of the same sync result announce once', async () => {
    db.set('zaznamnik/EBC-PS', ps(''));
    const [a, b] = await Promise.all([
      persistZaznamnikBatch({ 'EBC-PS': ps('9') }),
      persistZaznamnikBatch({ 'EBC-PS': ps('9') }),
    ]);
    expect(a.found).toEqual({ 'EBC-PS': [FOUND_9] });
    expect(b.found).toEqual({});
  });

  it('a save that fails stores neither half, so the next sync finds the points again', async () => {
    db.set('zaznamnik/EBC-PS', ps(''));
    failMeta.on = true;
    await expect(persistZaznamnikBatch({ 'EBC-PS': ps('9') })).rejects.toThrow();
    expect(db.get('zaznamnik/EBC-PS')).toEqual(ps(''));

    failMeta.on = false;
    const out = await persistZaznamnikBatch({ 'EBC-PS': ps('9') });
    expect(out.found).toEqual({ 'EBC-PS': [FOUND_9] });
  });

  it('stamps what a sync found with when it found it', async () => {
    db.set('zaznamnik/EBC-PS', ps(''));
    const out = await persistZaznamnikBatch({ 'EBC-PS': ps('9') });
    expect(out.found['EBC-PS']![0]!.at).toBe(NOW);
  });
});
