import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemesterCard } from '../SemesterCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { SubjectStatus } from '../../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../../utils/mobile/enrolledSubjects';
import type { SubjectSuccessRate } from '../../../../../types/documents';

function subj(over: Partial<SubjectStatus> = {}): SubjectStatus {
  return {
    id: '1',
    code: 'EBC-PSI',
    name: 'Počítačové sítě',
    credits: 6,
    type: 'zk',
    isEnrolled: true,
    isFulfilled: false,
    enrollmentCount: 1,
    rawStatusText: '',
    ...over,
  };
}

const enrolledOf = (s: SubjectStatus): EnrolledSubject => ({
  subject: s,
  semester: 3,
  done: false,
});

/**
 * A pass/fail rate of 28 % is the single most decision-relevant number the app
 * has about a subject, and the phone did not show it at all — the browser
 * extension has carried it on every row for as long as it has existed. Same
 * divergence as the enrolled-subjects one: the phone screen was written fresh
 * rather than reusing what the desktop already computed (`computeFailRate`).
 *
 * It carries its label, for the reason the desktop's had to stop being
 * hover-only: a bare colour-coded percentage does not say what it measures,
 * and on a touch screen nothing reveals it.
 */
function seedRate(code: string, pass: number, fail: number) {
  const rate: SubjectSuccessRate = {
    courseCode: code,
    lastUpdated: '2026-01-01',
    stats: [
      {
        semesterName: 'ZS 2025/2026',
        totalPass: pass,
        totalFail: fail,
        terms: [{ term: 'Všechny termíny', pass, fail }],
      },
    ],
  } as SubjectSuccessRate;
  useAppStore.setState({ successRates: { [code]: rate } } as never);
}

describe('SemesterCard fail rate', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      successRates: {},
      gradeHistory: null,
    } as never);
  });

  it('shows the failure rate with the word that says what it is', () => {
    // 28 of 100 fail.
    seedRate('EBC-PSI', 72, 28);
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    expect(screen.getByTestId('subject-fail-rate')).toHaveTextContent(/28\s*%/);
    expect(screen.getByTestId('subject-fail-rate')).toHaveTextContent(/neúspěšnost/i);
  });

  it('shows nothing where there is no data for the subject', () => {
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('subject-fail-rate')).not.toBeInTheDocument();
  });

  it('shows nothing on a subject the student has already passed', () => {
    // A rate is a forecast; once it is done, it is history.
    seedRate('EBC-PSI', 72, 28);
    const done = subj({ isFulfilled: true, isEnrolled: false });
    render(
      <SemesterCard
        enrolled={[{ subject: done, semester: 3, done: true }]}
        semester={3}
        onOpenSubject={() => {}}
      />
    );
    expect(screen.queryByTestId('subject-fail-rate')).not.toBeInTheDocument();
  });

  it('suppresses a rate computed from too few students', () => {
    // computeFailRate returns null below 10 results — a 50 % drawn from two
    // people is noise presented as a warning.
    seedRate('EBC-PSI', 3, 3);
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('subject-fail-rate')).not.toBeInTheDocument();
  });
});
