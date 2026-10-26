import { describe, it, expect } from 'vitest';
import {
  glyphFor,
  neutralSociety,
  resolveSociety,
  listedSocieties,
  autoFollowSocietyFor,
  toSocietyRecord,
  NEUTRAL_SOCIETY_COLOR,
} from '../resolveSociety';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

describe('glyphFor', () => {
  it('keeps a short name of up to four characters as-is', () => {
    expect(glyphFor('USAF')).toBe('USAF');
    expect(glyphFor('reIS')).toBe('reIS');
    expect(glyphFor('EY')).toBe('EY');
  });
  it('uses the first word when the name is long', () => {
    expect(glyphFor('AU FRRMS')).toBe('AU');
  });
  it('takes two capitals when even the first word is long', () => {
    expect(glyphFor('SUPEF')).toBe('SU');
  });
});

describe('resolveSociety', () => {
  it('returns the catalog entry', () => {
    expect(resolveSociety(BUNDLED_SOCIETIES, 'supef').shortName).toBe('SUPEF');
  });
  it('never falls back to ESN for an unknown id', () => {
    const soc = resolveSociety(BUNDLED_SOCIETIES, 'brand-new');
    expect(soc.id).toBe('brand-new');
    expect(soc.color).toBe(NEUTRAL_SOCIETY_COLOR);
    expect(soc.logo).toBeUndefined();
    expect(soc.facultyKey).toBe('mendelu');
  });
  it('builds the neutral glyph from the id', () => {
    expect(neutralSociety('kino').glyph).toBe('kino');
  });
});

describe('listedSocieties', () => {
  it('drops hidden societies and sorts by sortOrder', () => {
    const catalog = toSocietyRecord([
      { ...BUNDLED_SOCIETIES.zf!, sortOrder: 1 },
      { ...BUNDLED_SOCIETIES.esn!, sortOrder: 2 },
      { ...BUNDLED_SOCIETIES.ey!, isActive: false },
    ]);
    expect(listedSocieties(catalog).map((s) => s.id)).toEqual(['zf', 'esn']);
  });
});

describe('autoFollowSocietyFor', () => {
  it('finds the default society for a faculty and ignores others filed under it', () => {
    expect(autoFollowSocietyFor(BUNDLED_SOCIETIES, 'pef')).toBe('supef'); // not 'ey'
  });
  it('returns null for mendelu-wide', () => {
    expect(autoFollowSocietyFor(BUNDLED_SOCIETIES, 'mendelu')).toBeNull();
  });
  it('skips a hidden default', () => {
    const catalog = { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, isActive: false } };
    expect(autoFollowSocietyFor(catalog, 'zf')).toBeNull();
  });
});
