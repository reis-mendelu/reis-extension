import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyPlan } from '@/types/studyPlan';

// The rows pull in the whole subject drawer graph; this file is about the
// header above them.
vi.mock('../SubjectRow', () => ({
  SubjectRow: ({ subject }: { subject: { code: string } }) => <div>{subject.code}</div>,
}));

import { EnrolledNowSection } from '../EnrolledNowSection';

const subject = (code: string, enrolled: boolean) => ({
  id: '',
  code,
  name: code,
  credits: 5,
  type: 'P',
  isEnrolled: enrolled,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
});

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
          subjects: [subject('EBC-MAT', true), subject('EBC-PS', true)],
        },
      ],
    },
  ],
} as unknown as StudyPlan;

/**
 * "Aktuálně zapsáno" no longer counts the enrolled subjects with an error mark.
 *
 * The header carried a red ⊗ and the number of subjects in progress — eight of
 * them, for a student who had failed nothing. The icon is the app's error tone,
 * so the one glance the header is for said something had gone wrong with every
 * subject the student was currently taking. Being enrolled is not a failure,
 * and a count of what you are studying does not need a verdict attached.
 */
describe('EnrolledNowSection header', () => {
  const render_ = () =>
    render(<EnrolledNowSection plan={plan} onOpenSubject={vi.fn()} onSearchSubject={vi.fn()} />);

  it('shows no error-toned counter over the enrolled subjects', () => {
    const { container } = render_();
    expect(container.querySelector('.text-error')).toBeNull();
  });

  it('still lists the subjects it is a header for', () => {
    render_();
    expect(screen.getByText('EBC-MAT')).toBeInTheDocument();
    expect(screen.getByText('EBC-PS')).toBeInTheDocument();
  });
});
