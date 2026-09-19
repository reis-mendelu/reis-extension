import { describe, it, expect } from 'vitest';
import { REMOTE, walksThrough } from '../mapLayers';

const byName = (n: string) => REMOTE.find((p) => p.shortName.includes(n))!;

describe('walksThrough', () => {
  it('treats the arboretum as scenery you cross', () => {
    expect(walksThrough(byName('Botanická zahrada'))).toBe(true);
  });

  it('does NOT treat Panská lícha as scenery, though it also has an area', () => {
    // The regression this exists to stop: the rule was first written as
    // `!!place.area`, which is true of Panská lícha too. Its `area` is the
    // surrounding grounds, but the riding hall inside it is exactly the sort of
    // place a student is told to turn up at — and it silently stopped
    // answering a tap.
    const pl = byName('Panská lícha');
    expect(pl.area).toBeTruthy();
    expect(walksThrough(pl)).toBe(false);
  });

  it('leaves the far sites alone', () => {
    for (const n of ['Lednice', 'Žabčice', 'Křtiny']) expect(walksThrough(byName(n))).toBe(false);
  });

  it('is exactly one place today', () => {
    expect(REMOTE.filter(walksThrough).map((p) => p.shortName)).toEqual([
      'Botanická zahrada a arboretum',
    ]);
  });
});
