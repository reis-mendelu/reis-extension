import { describe, it, expect } from 'vitest';
import { StudyPlanSchema, StudyPlanOrDualLanguageSchema } from '../studyPlan.schema';
import type { StudyPlan } from '../../studyPlan';

// A representative real study plan (mirrors what syncStudyPlan writes).
const realPlan: StudyPlan = {
  title: 'Bakalářský studijní program',
  isFulfilled: false,
  creditsAcquired: 120,
  creditsRequired: 180,
  blocks: [
    {
      title: '1. semestr',
      groups: [
        {
          name: 'Povinné předměty',
          statusDescription: 'splněno',
          minCount: 5,
          minCredits: 30,
          subjects: [
            {
              id: 's1',
              code: 'EBC-ALG',
              name: 'Algebra',
              credits: 6,
              type: 'P',
              isEnrolled: true,
              isFulfilled: true,
              enrollmentCount: 1,
              rawStatusText: 'splněno v ZS 2025/2026',
            },
          ],
        },
      ],
    },
  ],
  zameranis: [{ name: 'Zaměření A', subjects: [{ code: 'EBC-ALG', name: 'Algebra' }] }],
  zameraniMinimum: 1,
};

describe('StudyPlanSchema', () => {
  it('accepts a representative real study plan (never drops valid data)', () => {
    expect(StudyPlanSchema.safeParse(realPlan).success).toBe(true);
  });

  it('accepts unknown/future fields via passthrough', () => {
    const withExtra = {
      ...realPlan,
      futureField: 'x',
      blocks: [{ ...realPlan.blocks[0], brandNewFlag: true }],
    };
    expect(StudyPlanSchema.safeParse(withExtra).success).toBe(true);
  });

  it('accepts an unexpected subject.type value (widened to string, no drift-drop)', () => {
    // safe: fixed literal fixture
    const block0 = realPlan.blocks[0]!;
    const group0 = block0.groups[0]!;
    const subject0 = group0.subjects[0]!;
    const drift = {
      ...realPlan,
      blocks: [
        {
          ...block0,
          groups: [
            {
              ...group0,
              subjects: [{ ...subject0, type: 'new_kind' }],
            },
          ],
        },
      ],
    };
    expect(StudyPlanSchema.safeParse(drift).success).toBe(true);
  });

  it('accepts a plan with no zameranis (optional field)', () => {
    const { zameranis: _zameranis, zameraniMinimum: _zameraniMinimum, ...noZamerani } = realPlan;
    expect(StudyPlanSchema.safeParse(noZamerani).success).toBe(true);
  });

  it('rejects genuine corruption: null root', () => {
    expect(StudyPlanSchema.safeParse(null).success).toBe(false);
  });

  it('rejects genuine corruption: blocks is not an array', () => {
    expect(StudyPlanSchema.safeParse({ ...realPlan, blocks: 'nope' }).success).toBe(false);
  });

  it('rejects genuine corruption: subject entry missing code', () => {
    // safe: fixed literal fixture
    const block0 = realPlan.blocks[0]!;
    const group0 = block0.groups[0]!;
    const { code: _code, ...noCode } = group0.subjects[0]!;
    const corrupted = {
      ...realPlan,
      blocks: [
        {
          ...block0,
          groups: [{ ...group0, subjects: [noCode] }],
        },
      ],
    };
    expect(StudyPlanSchema.safeParse(corrupted).success).toBe(false);
  });
});

describe('StudyPlanOrDualLanguageSchema (union used by the IDB store)', () => {
  it('accepts the single-language shape', () => {
    expect(StudyPlanOrDualLanguageSchema.safeParse(realPlan).success).toBe(true);
  });

  it('accepts the dual-language shape', () => {
    expect(StudyPlanOrDualLanguageSchema.safeParse({ cz: realPlan, en: realPlan }).success).toBe(
      true
    );
  });

  it('rejects genuine corruption: null', () => {
    expect(StudyPlanOrDualLanguageSchema.safeParse(null).success).toBe(false);
  });
});
