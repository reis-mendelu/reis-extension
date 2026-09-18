import { describe, it, expect } from 'vitest';
import { driftedSeedKeys, stableStringify } from '../seedGuard';

/**
 * The guard behind `verify:ui --seed-store`. Its whole job is to turn a
 * silently-clobbered seed — a run that measures an UNSEEDED page and reports
 * clean — into a loud failure, so its own correctness has to be pinned.
 */
describe('driftedSeedKeys', () => {
  const seeded = { schedule: { status: 'success', data: [{ id: 'a', date: '20260919' }] } };

  it('reports nothing when the seed is still there', () => {
    expect(driftedSeedKeys(seeded, { schedule: seeded.schedule })).toEqual([]);
  });

  it('names the key the app overwrote', () => {
    expect(driftedSeedKeys(seeded, { schedule: { status: 'success', data: [] } })).toEqual([
      'schedule',
    ]);
  });

  it('does NOT cry drift when the store rebuilt an object with keys in another order', () => {
    // Zustand replacing a slice with an equivalent object is not a lost seed,
    // and a naive JSON.stringify compare would fail every such run.
    const reordered = { schedule: { data: [{ date: '20260919', id: 'a' }], status: 'success' } };
    expect(driftedSeedKeys(seeded, reordered)).toEqual([]);
  });

  it('treats a missing key as drift', () => {
    expect(driftedSeedKeys(seeded, {})).toEqual(['schedule']);
  });

  it('checks every seeded key, not just the first', () => {
    const many = { a: 1, b: 2, c: 3 };
    expect(driftedSeedKeys(many, { a: 1, b: 99, c: 3 })).toEqual(['b']);
    expect(driftedSeedKeys(many, { a: 0, b: 99, c: 3 })).toEqual(['a', 'b']);
  });

  it('is not fooled by array order, which IS meaningful', () => {
    const two = { xs: [1, 2] };
    expect(driftedSeedKeys(two, { xs: [2, 1] })).toEqual(['xs']);
  });
});

describe('stableStringify', () => {
  it('normalises nested key order but preserves arrays', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, 4] } })).toBe(
      stableStringify({ a: { c: [3, 4], d: 2 }, b: 1 })
    );
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
});
