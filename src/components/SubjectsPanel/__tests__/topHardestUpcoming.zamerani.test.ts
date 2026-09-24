import { describe, it, expect } from 'vitest';
import { topHardestUpcoming } from '../insights';
import { buildSubjectToZameranis } from '../utils';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';
import type { SubjectSuccessRate } from '@/types/documents';

/**
 * "Nejtěžší předměty, které tě čekají shows subjects that I have not chosen as
 * my zaměření — I will not have the subject, but it still shows."
 *
 * A B-OI plan lists every zaměření's subjects in its semester blocks — 20 of
 * them across five zaměření, of which the student takes two. IS does not say
 * which two: every `EBC-ZB*` placeholder reads unfulfilled and unenrolled, so
 * the student's own pick (`useZameraniPicks`) is the only record of the choice.
 *
 * The semester list already honoured it (`isSubjectVisible`); this card walked
 * `plan.blocks` with nothing but the fulfilled/attempted skips, so a subject of
 * a zaměření the student never picked was "ahead" of them. One rule now, used
 * by both.
 */
const subject = (code: string, name = code): SubjectStatus => ({
  id: `id-${code}`,
  code,
  name,
  credits: 5,
  type: 'P',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
});

const plan: StudyPlan = {
  title: 'B-OI',
  isFulfilled: false,
  creditsAcquired: 0,
  creditsRequired: 180,
  zameraniMinimum: 2,
  zameranis: [
    {
      name: 'Zaměření: Vývoj webových aplikací',
      subjects: [{ code: 'EBC-EA', name: 'Enterprise aplikace' }],
    },
    { name: 'Zaměření: Řízení podniku', subjects: [{ code: 'EBC-MAR', name: 'Marketing 1' }] },
  ],
  blocks: [
    {
      title: '5. semestr (dosud neaktivní)',
      groups: [
        {
          name: 'POVINNÉ',
          statusDescription: '',
          subjects: [
            subject('EBC-MANDATORY', 'Povinný předmět'),
            subject('EBC-EA', 'Enterprise aplikace'),
            subject('EBC-MAR', 'Marketing 1'),
            subject('EBC-ZBVWA', 'Zaměření: vývoj webových aplikací'),
          ],
        },
      ],
    },
  ],
} as unknown as StudyPlan;

const rate = (code: string, fail: number): SubjectSuccessRate => ({
  courseCode: code,
  lastUpdated: '',
  stats: [
    {
      semesterName: 'ZS 2025/2026',
      semesterId: '1',
      year: 2025,
      totalPass: 100 - fail,
      totalFail: fail,
      terms: [],
    },
  ] as unknown as SubjectSuccessRate['stats'],
});

const successRates: Record<string, SubjectSuccessRate> = {
  'EBC-MANDATORY': rate('EBC-MANDATORY', 40),
  'EBC-EA': rate('EBC-EA', 60),
  'EBC-MAR': rate('EBC-MAR', 50),
  'EBC-ZBVWA': rate('EBC-ZBVWA', 90),
};

const codes = (picked: string[]) =>
  topHardestUpcoming(
    plan,
    successRates,
    new Map(),
    buildSubjectToZameranis(plan),
    new Set(picked)
  ).map((e) => e.subject.code);

describe('topHardestUpcoming: only the zaměření the student picked', () => {
  it('with no pick, shows no zaměření subject — as the semester list does', () => {
    expect(codes([])).toEqual(['EBC-MANDATORY']);
  });

  it('hides a subject of a zaměření the student did not pick', () => {
    expect(codes(['rizeni podniku'])).toEqual(['EBC-MAR', 'EBC-MANDATORY']);
  });

  it('shows the subjects of every zaměření the student picked', () => {
    expect(codes(['vyvoj webovych aplikaci', 'rizeni podniku'])).toEqual([
      'EBC-EA',
      'EBC-MAR',
      'EBC-MANDATORY',
    ]);
  });

  it('never lists the zaměření placeholder row itself', () => {
    expect(codes(['vyvoj webovych aplikaci'])).not.toContain('EBC-ZBVWA');
  });
});
