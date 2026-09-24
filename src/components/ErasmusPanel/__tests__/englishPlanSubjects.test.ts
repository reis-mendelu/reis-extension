import { describe, it, expect, vi } from 'vitest';
import { englishPlanSubjects } from '../englishPlanSubjects';
import type { DualLanguageStudyPlan, StudyPlan } from '../../../types/studyPlan';

/**
 * The Erasmus PDF prints English subject names whatever the UI language (EU
 * guidelines). A Czech student's sync fetches no English study plan, so the
 * export asks IS for it when the button is pressed — never before.
 */
const plan = (name: string): StudyPlan =>
  ({
    title: 'P',
    isFulfilled: false,
    creditsAcquired: 0,
    creditsRequired: 0,
    blocks: [{ title: 'B', groups: [{ name: 'G', statusDescription: '', subjects: [{ name }] }] }],
  }) as unknown as StudyPlan;

describe('englishPlanSubjects', () => {
  it('uses the English plan already held, without fetching', async () => {
    const fetchEnglish = vi.fn();
    const dual: DualLanguageStudyPlan = { cz: plan('Matematika'), en: plan('Mathematics') };
    const subjects = await englishPlanSubjects(dual, 'st1', fetchEnglish);
    expect(subjects.map((s) => s.name)).toEqual(['Mathematics']);
    expect(fetchEnglish).not.toHaveBeenCalled();
  });

  it("fetches the English plan when a Czech student's sync held none", async () => {
    const fetchEnglish = vi.fn(async () => plan('Mathematics'));
    const dual: DualLanguageStudyPlan = { cz: plan('Matematika'), en: null };
    const subjects = await englishPlanSubjects(dual, 'st1', fetchEnglish);
    expect(fetchEnglish).toHaveBeenCalledWith('st1');
    expect(subjects.map((s) => s.name)).toEqual(['Mathematics']);
  });

  it('exports no subjects rather than Czech names when English cannot be had', async () => {
    const dual: DualLanguageStudyPlan = { cz: plan('Matematika'), en: null };
    await expect(englishPlanSubjects(dual, undefined, vi.fn())).resolves.toEqual([]);
    await expect(
      englishPlanSubjects(
        dual,
        'st1',
        vi.fn(async () => null)
      )
    ).resolves.toEqual([]);
  });
});
