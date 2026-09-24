import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseStudyPlanDOM } from '../studyPlan';
import { repeatedSemesterTitles } from '../studyPlanSortMode';
import type { StudyPlan } from '../../types/studyPlan';

/**
 * IS renders Kontrola plánu in two sort modes, and remembers the last one the
 * student clicked — server-side, per account, across sessions.
 *
 * Measured on 2026-09-23 against one account, one session, in this order:
 *
 *   ?razeni=plany   → "Řazení po studijních plánech", semesters listed twice
 *   (no razeni)     → still by plans
 *   ?razeni=obdobi  → "Řazení po obdobích", each semester once
 *   (no razeni)     → still by periods
 *
 * In by-plans mode a study made of several plans (program + specializace +
 * zaměření, e.g. B-EAM-EBMM-ZBFMP) gets one run of "N. semestr" headers per
 * plan, and the parser — written against by-periods — turns every header into
 * a new block. That is the "semesters reappear" bug a student reported with
 * the page in `study-plan-by-plans.three-plans.cz.html`.
 *
 * reIS used to request the page without `razeni`, so what it parsed depended
 * on a click the student made in IS, possibly months earlier. Every fixture
 * and dump came from an account whose remembered mode was by-periods.
 */
const load = (name: string) =>
  new DOMParser().parseFromString(
    readFileSync(resolve(process.cwd(), `src/api/__tests__/fixtures/${name}`), 'utf8'),
    'text/html'
  );

const codes = (plan: StudyPlan) =>
  plan.blocks.flatMap((b) => b.groups.flatMap((g) => g.subjects.map((s) => s.code))).sort();

describe('the by-plans sort mode is what repeats semesters', () => {
  it('reproduces the reported page: three plans, semesters repeated', () => {
    const plan = parseStudyPlanDOM(load('study-plan-by-plans.three-plans.cz.html'), 'cz');
    expect(repeatedSemesterTitles(plan)).toEqual([
      '1. semestr ZS 2024/2025 - PEF',
      '2. semestr LS 2024/2025 - PEF',
      '3. semestr ZS 2025/2026 - PEF',
      '4. semestr LS 2025/2026 - PEF',
      '5. semestr ZS 2026/2027 - PEF',
      '6. semestr LS 2026/2027 - PEF',
    ]);
  });

  for (const lang of ['cz', 'en'] as const) {
    it(`repeats on a two-plan study too, and by-periods does not (${lang})`, () => {
      const byPlans = parseStudyPlanDOM(load(`study-plan-by-plans.two-plans.${lang}.html`), lang);
      const byPeriods = parseStudyPlanDOM(
        load(`study-plan-by-periods.two-plans.${lang}.html`),
        lang
      );
      expect(repeatedSemesterTitles(byPlans)).toHaveLength(6);
      expect(repeatedSemesterTitles(byPeriods)).toEqual([]);
    });

    it(`by-periods carries every subject by-plans does, so pinning it loses nothing (${lang})`, () => {
      const byPlans = parseStudyPlanDOM(load(`study-plan-by-plans.two-plans.${lang}.html`), lang);
      const byPeriods = parseStudyPlanDOM(
        load(`study-plan-by-periods.two-plans.${lang}.html`),
        lang
      );
      expect(codes(byPeriods)).toEqual(codes(byPlans));
      expect(byPeriods.creditsAcquired).toBe(byPlans.creditsAcquired);
      expect(byPeriods.creditsRequired).toBe(byPlans.creditsRequired);
    });
  }
});

const fetchWithAuth = vi.fn();
vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
}));
const logError = vi.fn();
vi.mock('../../utils/reportError', () => ({
  logError: (...a: unknown[]) => logError(...a),
}));

describe('fetchDualLanguageStudyPlan', () => {
  const html = (name: string) =>
    readFileSync(resolve(process.cwd(), `src/api/__tests__/fixtures/${name}`), 'utf8');

  beforeEach(() => {
    fetchWithAuth.mockReset();
    logError.mockReset();
  });

  it('pins razeni=obdobi on both languages instead of inheriting the student’s last click', async () => {
    fetchWithAuth.mockImplementation((url: string) =>
      Promise.resolve(
        new Response(
          html(`study-plan-by-periods.two-plans.${url.includes('lang=en') ? 'en' : 'cz'}.html`)
        )
      )
    );
    const { fetchDualLanguageStudyPlan } = await import('../studyPlan');
    await fetchDualLanguageStudyPlan('100000');

    const urls = fetchWithAuth.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(2);
    for (const url of urls) expect(url).toContain('razeni=obdobi');
    expect(logError).not.toHaveBeenCalled();
  });

  it('reports a repeated semester instead of shipping it silently', async () => {
    fetchWithAuth.mockImplementation(() =>
      Promise.resolve(new Response(html('study-plan-by-plans.three-plans.cz.html')))
    );
    const { fetchDualLanguageStudyPlan } = await import('../studyPlan');
    await fetchDualLanguageStudyPlan('100000');

    expect(logError).toHaveBeenCalledWith(
      'Api.fetchDualLanguageStudyPlan',
      expect.any(Error),
      expect.objectContaining({ lang: 'cz' })
    );
  });
});
