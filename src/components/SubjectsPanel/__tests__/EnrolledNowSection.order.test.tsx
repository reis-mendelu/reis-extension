import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

vi.mock('../SubjectRow', () => ({
  SubjectRow: ({ subject }: { subject: { code: string } }) => <div>{subject.code}</div>,
}));

import { EnrolledNowSection } from '../EnrolledNowSection';

const subject = (code: string): SubjectStatus => ({
  id: '',
  code,
  name: code,
  credits: 5,
  type: 'P',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
});

/** Plan order deliberately unrelated to difficulty, so a pass means sorting. */
const plan = {
  title: 'B-OI prez',
  isFulfilled: false,
  creditsAcquired: 59,
  creditsRequired: 180,
  blocks: [
    {
      title: '3. semestr',
      groups: [
        {
          name: 'Povinné',
          statusDescription: '',
          subjects: [
            subject('MATLAB'),
            subject('SITE'),
            subject('WEB'),
            subject('NORATE'),
            subject('EKONOMIKA'),
          ],
        },
      ],
    },
  ],
} as unknown as StudyPlan;

const failRates = { MATLAB: 9, SITE: 28, WEB: 11, EKONOMIKA: 25, NORATE: null };

/** Today, so the passed row falls inside whatever semester the clock is in. */
const fulfilledThisSemester = (() => {
  const d = new Date();
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
})();

const codesInOrder = () =>
  screen.getAllByText(/^(MATLAB|SITE|WEB|NORATE|EKONOMIKA)$/).map((el) => el.textContent);

/**
 * Hardest first.
 *
 * The section listed whatever order the study plan happened to hold, so the
 * subject most likely to cost the student their semester could sit last. The
 * rates are already on every row; ordering by them is what turns a list into a
 * ranking.
 */
describe('EnrolledNowSection ordering', () => {
  it('puts the hardest subject first and the easiest last', () => {
    render(
      <EnrolledNowSection
        plan={plan}
        failRates={failRates}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    expect(codesInOrder()).toEqual(['SITE', 'EKONOMIKA', 'WEB', 'MATLAB', 'NORATE']);
  });

  it('ranks a subject with no rate below one measured at 0 %', () => {
    // The distinction that matters: a missing rate is "not enough data"
    // (computeFailRate returns null under ten results), not a measured zero.
    render(
      <EnrolledNowSection
        plan={plan}
        failRates={{ MATLAB: 0 }}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    const order = codesInOrder();
    expect(order[0]).toBe('MATLAB');
    expect(order).toHaveLength(5);
  });

  it('falls back to the plan order when nothing has a rate', () => {
    render(<EnrolledNowSection plan={plan} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expect(codesInOrder()).toEqual(['MATLAB', 'SITE', 'WEB', 'NORATE', 'EKONOMIKA']);
  });

  it('keeps the subjects already passed in the same list, at the end', () => {
    // They used to be a second group behind a collapsed "N splněno" divider.
    // One list now — the tick and the date on a fulfilled row are what say it
    // is done.
    const withPassed = {
      ...plan,
      blocks: [
        {
          ...plan.blocks[0],
          groups: [
            {
              ...plan.blocks[0]!.groups[0],
              subjects: [
                {
                  ...subject('DONE'),
                  isEnrolled: false,
                  isFulfilled: true,
                  enrollmentCount: 1,
                  // Inside the current semester, which is what puts it in this
                  // section at all — see isThisSemester.
                  fulfillmentDate: fulfilledThisSemester,
                },
                subject('SITE'),
                subject('MATLAB'),
              ],
            },
          ],
        },
      ],
    } as unknown as StudyPlan;

    render(
      <EnrolledNowSection
        plan={withPassed}
        failRates={{ SITE: 28, MATLAB: 9, DONE: 40 }}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    // DONE carries the highest rate of the three and still sorts last: a passed
    // subject is history, and its rate is not even drawn.
    expect(screen.getAllByText(/^(SITE|MATLAB|DONE)$/).map((el) => el.textContent)).toEqual([
      'SITE',
      'MATLAB',
      'DONE',
    ]);
  });
});
