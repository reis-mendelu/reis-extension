import { describe, it, expect } from 'vitest';
import type { DualLanguageStudyPlan } from '@/types/studyPlan';
import { studyPlanCounts } from '../studyPlanCounts';

/**
 * Suggestion 46: Předměty draws from the study plan, and the report said
 * nothing about it. These are the numbers the screen decides on.
 */
const subj = (code: string, isEnrolled: boolean) => ({
  id: code,
  code,
  name: 'Secret name',
  credits: 5,
  type: 'P',
  isEnrolled,
  isFulfilled: false,
  enrollmentCount: isEnrolled ? 1 : 0,
  rawStatusText: '',
});
const block = (title: string, subjects: ReturnType<typeof subj>[]) => ({
  title,
  groups: [{ name: 'g', statusLabel: '', subjects }],
});
const plan = (blocks: ReturnType<typeof block>[]) => ({
  title: 'Plan title',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  blocks,
});
const dual = {
  cz: plan([block('1. semestr', [])]),
  en: plan([
    block('1. semester', [subj('XX1', false)]),
    block('2. semester', [subj('XX2', true), subj('XX3', false)]),
  ]),
} as unknown as DualLanguageStudyPlan;

describe('studyPlanCounts', () => {
  it('counts the plan in the app language: blocks, subjects, enrolled now', () => {
    const out = studyPlanCounts({ studyPlanDual: dual, studyPlanLoaded: true, language: 'en' });
    expect(out).toEqual({
      studyPlan: 'success',
      planBlocks: 2,
      planSubjects: 3,
      planEnrolledNow: 1,
    });
    expect(JSON.stringify(out)).not.toMatch(/XX\d|Secret|Plan title|semest/);
  });

  it('reads the Czech plan when the app is in Czech', () => {
    const out = studyPlanCounts({ studyPlanDual: dual, studyPlanLoaded: true, language: 'cz' });
    expect(out.planBlocks).toBe(1);
    expect(out.planSubjects).toBe(0);
  });

  it('tells a plan still loading from IndexedDB from no plan at all', () => {
    expect(studyPlanCounts({ studyPlanLoaded: false, language: 'cz' }).studyPlan).toBe('loading');
    expect(studyPlanCounts({ studyPlanDual: null, studyPlanLoaded: true, language: 'cz' })).toEqual(
      { studyPlan: 'none', planBlocks: 0, planSubjects: 0, planEnrolledNow: 0 }
    );
  });

  it('drops the fields, never throws, on a plan of an unexpected shape', () => {
    const bad = { en: { blocks: 'nope' } } as unknown as DualLanguageStudyPlan;
    expect(studyPlanCounts({ studyPlanDual: bad, studyPlanLoaded: true, language: 'en' })).toEqual(
      {}
    );
  });
});
