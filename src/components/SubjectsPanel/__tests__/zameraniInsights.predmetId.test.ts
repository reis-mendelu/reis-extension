import { describe, it, expect } from 'vitest';
import { zameraniInsights } from '../insights';
import type { StudyPlan } from '@/types/studyPlan';
import type { SubjectSuccessRate } from '@/types/documents';

/**
 * "when I clicked on the enterprise application, what opened instead was the
 * search for people and subjects, which makes no sense — it's a completely
 * different screen"
 *
 * Not a layering fault. `ZameraniRow` is
 * `s.id ? onOpen(...) : onSearch(s.code)`, and on the phone `onSearch` is
 * `pushSheet({ kind: 'search' })` — so a zaměření subject with no id opened the
 * search screen by design. The bug is that the id was missing.
 *
 * `ZamerangSubjectRef` is only `{ code, name }` — IS's zaměření listing carries
 * no ids — so `zameraniInsights` recovered them from `plan.blocks`. But a
 * zaměření lists subjects the student has NOT got in their own plan, which is
 * the entire point of comparing zaměření before picking one. Against real data
 * that was 10 of 20 rows, "EBC-EA Enterprise aplikace" among them.
 *
 * `SubjectRow` had already solved this for exactly the same reason —
 * `subject.id || resolvePredmetId(successRate)` — and `zameraniInsights`
 * already takes `successRates`. It just never asked.
 */
describe('zameraniInsights: recovering a predmet id for a subject outside the plan', () => {
  const plan = (): StudyPlan =>
    ({
      title: 'B-OI',
      isFulfilled: false,
      creditsAcquired: 0,
      creditsRequired: 180,
      zameranis: [
        {
          name: 'Vývoj webových aplikací',
          subjects: [
            { code: 'EBC-WAF', name: 'Webové aplikace: frontend' },
            { code: 'EBC-EA', name: 'Enterprise aplikace' },
            { code: 'EXA-UP03', name: 'EXA-UP03' },
            { code: 'EBC-XX', name: 'Bez statistik' },
          ],
        },
        // A second zaměření: the card renders nothing below two.
        { name: 'Řízení podniku', subjects: [{ code: 'EBC-RP', name: 'Řízení podniku' }] },
      ],
      blocks: [
        {
          semester: 3,
          groups: [
            {
              name: 'POVINNÉ',
              subjects: [
                {
                  code: 'EBC-WAF',
                  name: 'Webové aplikace: frontend',
                  id: '111111',
                  credits: 5,
                },
              ],
            },
          ],
        },
      ],
    }) as unknown as StudyPlan;

  const rate = (predmetId: string): SubjectSuccessRate =>
    ({ predmetId, stats: [] }) as unknown as SubjectSuccessRate;

  const rates: Record<string, SubjectSuccessRate> = {
    // The one that was reported. Not in the student's plan blocks.
    'EBC-EA': rate('156607'),
    // A junk id, as reis-data really carries for the mobility placeholders.
    'EXA-UP03': rate('999'),
    // Enrolled: the plan already knows a different id for it.
    'EBC-WAF': rate('222222'),
  };

  const subjects = () => {
    const web = zameraniInsights(plan(), rates).find((z) => z.name.startsWith('Vývoj webových'))!;
    return new Map(web.subjects.map((s) => [s.code, s]));
  };

  it('recovers the id from the success-rate record — the reported subject', () => {
    expect(subjects().get('EBC-EA')!.id).toBe('156607');
  });

  // The plan is the better source: it is the student's own enrolment, and
  // `SubjectRow` prefers it the same way round.
  it('prefers the plan id when the subject is in the plan', () => {
    expect(subjects().get('EBC-WAF')!.id).toBe('111111');
  });

  /**
   * "999" is not a predmet id. `resolvePredmetId` rejects anything under five
   * digits because reis-data carries junk that resolves to the WRONG subject —
   * and opening the wrong subject is worse than the search fallback, which at
   * least leaves the student somewhere they can act.
   */
  it('refuses a junk id, so the fallback still happens rather than a wrong subject', () => {
    expect(subjects().get('EXA-UP03')!.id).toBe('');
  });

  it('leaves the id empty when there is no record at all', () => {
    expect(subjects().get('EBC-XX')!.id).toBe('');
  });

  // The rest of the row is unchanged: the name still comes from the plan when
  // it knows it and from the zaměření listing otherwise.
  it('keeps naming the subject', () => {
    expect(subjects().get('EBC-EA')!.name).toBe('Enterprise aplikace');
  });
});
