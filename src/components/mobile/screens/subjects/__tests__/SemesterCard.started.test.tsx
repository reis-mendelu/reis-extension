import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemesterCard } from '../SemesterCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { SubjectStatus } from '../../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../../utils/mobile/enrolledSubjects';

function subject(code: string): SubjectStatus {
  return {
    id: code,
    code,
    name: code,
    credits: 5,
    type: 'zk',
    isEnrolled: true,
    isFulfilled: false,
    enrollmentCount: 1,
    rawStatusText: '',
  };
}
const enrolledOf = (codes: string[]): EnrolledSubject[] =>
  codes.map((c) => ({ subject: subject(c), semester: 3, done: false }));

/**
 * The line under "5. semestr" says how many subjects the student is enrolled
 * in, and nothing else.
 *
 * It used to say whether term had started ("právě běží", "začíná 21. 9.") and
 * the credit total. Both were facts nobody acts on from this card — the date
 * belongs to the calendar, and the credits are already on every row below —
 * while the one number a student does check here, how many subjects they have,
 * was not on it at all.
 */
describe('SemesterCard — enrolled count', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', successRates: {}, gradeHistory: null } as never);
  });

  it('counts the enrolled subjects, with the Czech plural', () => {
    render(
      <SemesterCard
        enrolled={enrolledOf(['A', 'B', 'C', 'D', 'E', 'F', 'G'])}
        semester={5}
        onOpenSubject={() => {}}
      />
    );
    expect(screen.getByText('7 zapsaných předmětů')).toBeInTheDocument();
  });

  it('uses the few-form for two to four', () => {
    render(
      <SemesterCard enrolled={enrolledOf(['A', 'B', 'C'])} semester={5} onOpenSubject={() => {}} />
    );
    expect(screen.getByText('3 zapsané předměty')).toBeInTheDocument();
  });

  it('no longer says whether term is running, nor the credit total', () => {
    render(
      <SemesterCard enrolled={enrolledOf(['A', 'B'])} semester={5} onOpenSubject={() => {}} />
    );
    expect(screen.queryByText(/právě běží|začíná/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ kr\./)).not.toBeInTheDocument();
  });
});
