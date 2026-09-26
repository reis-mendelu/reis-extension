import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCatalogPlan, subjectsToAttend, toStudyPlan } from '../catalogPlan';
import { parseDoc } from '../text';

const fx = (n: string) =>
  parseDoc(readFileSync(resolve(process.cwd(), 'src/api/impersonation/__tests__/fixtures', n), 'utf8'));

// Real B-F Finance leaf, intake ZS 2025/2026 (stud_plan 12490), fetched 2026-09-26.
describe('parseCatalogPlan', () => {
  const cz = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'));
  const en = parseCatalogPlan(fx('catalog-plan-bf-801.en.html'));

  it('reads all six semesters in both languages', () => {
    expect(cz.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(en.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cz[0]!.title).toBe('1. semestr ZS 2025/2026 - PEF');
    expect(en[2]!.title).toBe('3rd semester WS 2026/2027 - FBE');
  });

  it('reads semester 3: five required subjects and a min-2-credit elective group', () => {
    const s3 = cz[2]!;
    expect(s3.groups.map((g) => g.name)).toEqual([
      'Skupina předmětů povinných',
      'Skupina předmětů povinně volitelných (min. 2 kr.)',
    ]);
    expect(s3.groups[0]!.rows.map((r) => r.code)).toEqual([
      'EBC-AZD',
      'EBC-FT',
      'EBC-FU',
      'EBC-MA',
      'EBC-MAR',
    ]);
    expect(s3.groups[1]!.minCredits).toBe(2);
    expect(s3.groups[1]!.rows.map((r) => r.code)).toEqual(['EBA-OTDU', 'EBA-OTF']);
  });

  it("links THIS period's subject ids for the semester being taught now", () => {
    // Equal to timetable 5769's predmet ids — the join the year-2+ path relies on.
    const ft = cz[2]!.groups[0]!.rows.find((r) => r.code === 'EBC-FT')!;
    expect(ft.predmetId).toBe('164066');
    expect(ft.credits).toBeGreaterThan(0);
    expect(ft.completion).not.toBe('');
  });
});

describe('subjectsToAttend', () => {
  const sems = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'));
  it('takes every required subject and fills electives up to the group minimum', () => {
    const codes = subjectsToAttend(sems[2]!).map((r) => r.code);
    expect(codes.slice(0, 5)).toEqual(['EBC-AZD', 'EBC-FT', 'EBC-FU', 'EBC-MA', 'EBC-MAR']);
    expect(codes).toContain('EBA-OTDU');
    expect(codes).not.toContain('EBA-OTF');
  });
  it('never picks the 999-credit EXA-UP placeholders', () => {
    expect(subjectsToAttend(sems[4]!).some((r) => r.code.startsWith('EXA-UP'))).toBe(false);
  });
});

describe('toStudyPlan', () => {
  it('maps to the StudyPlan shape and marks only the chosen current subjects enrolled', () => {
    const sems = parseCatalogPlan(fx('catalog-plan-bf-801.cz.html'));
    const plan = toStudyPlan(sems, 'B-F Finance', { semester: 3, codes: new Set(['EBC-FT']) });
    expect(plan.blocks).toHaveLength(6);
    const all = plan.blocks.flatMap((b) => b.groups.flatMap((g) => g.subjects));
    expect(all.filter((s) => s.isEnrolled).map((s) => s.code)).toEqual(['EBC-FT']);
    expect(all.every((s) => !s.isFulfilled && s.enrollmentCount === 0)).toBe(true);
    expect(plan.blocks[2]!.groups[1]!.minCredits).toBe(2);
    expect(plan.creditsRequired).toBeGreaterThan(0);
  });
});
