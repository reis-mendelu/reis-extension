import { describe, it, expect } from 'vitest';
import { BUNDLED_SOCIETIES } from '../societies';

// The bundled seed is what a first-ever launch shows before the catalog
// arrives. It must match the migration's seed rows, or a student sees one
// branding for a second and another after the fetch.
describe('BUNDLED_SOCIETIES', () => {
  it('holds the eight seeded societies', () => {
    expect(Object.keys(BUNDLED_SOCIETIES).sort()).toEqual([
      'au_frrms',
      'esn',
      'ey',
      'ldf',
      'reis',
      'supef',
      'usaf',
      'zf',
    ]);
  });
  it('carries no logo URLs: they exist only after the prod seed', () => {
    for (const s of Object.values(BUNDLED_SOCIETIES)) expect(s.logo).toBeUndefined();
  });
  it('has exactly one auto-follow society per faculty', () => {
    const auto = Object.values(BUNDLED_SOCIETIES).filter((s) => s.autoFollowFaculty);
    expect(auto.map((s) => s.facultyKey).sort()).toEqual(['af', 'frrms', 'ldf', 'pef', 'zf']);
  });
});
