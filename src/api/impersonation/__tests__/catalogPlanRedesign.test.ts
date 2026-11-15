import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCatalogPlan, subjectsToAttend } from '../catalogPlan';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(
    readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8')
  );

/**
 * The UIS redesign (live on is.mendelu.cz since 2026-11-15) prints a plan
 * leaf's semester heading as `<span style="font-size: 1.125rem; font-weight:
 * bold;">` where it printed `<b><font size="+1">`; the group rows kept `<b >`.
 * Before the fix this page parsed to zero semesters, so every "view as another
 * programme" request ended in `noSemester`. Real PEF B-OI leaf, 2026-11-16.
 * The old markup still parses through catalogPlan.test.ts (B-F, 2026-09-26).
 */
describe('parseCatalogPlan on the redesigned IS', () => {
  const cz = parseCatalogPlan(fx('catalog-plan-boi-redesigned.cz.html'));
  const en = parseCatalogPlan(fx('catalog-plan-boi-redesigned.en.html'));

  it('reads all six semesters in both languages', () => {
    expect(cz.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(en.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cz[0]!.title).toBe('1. semestr ZS 2026/2027 - PEF');
    expect(en[1]!.title).toBe('2nd semester SS 2026/2027 - FBE');
  });

  it('reads the groups and subjects under each semester', () => {
    expect(cz[0]!.groups.map((g) => g.name)).toEqual(['Skupina předmětů povinných']);
    expect(cz[0]!.groups[0]!.rows.map((r) => r.code)).toEqual([
      'EBC-ALG',
      'EBC-AP',
      'EBC-KOM',
      'EBC-TZI',
      'EBC-UICT',
      'EBC-ZOO',
    ]);
    expect(cz[2]!.groups[1]!.minCount).toBe(1);
    expect(subjectsToAttend(cz[0]!)).toHaveLength(6);
  });
});
