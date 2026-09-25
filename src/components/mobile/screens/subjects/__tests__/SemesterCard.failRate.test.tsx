import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemesterCard } from '../SemesterCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { SubjectStatus } from '../../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../../utils/mobile/enrolledSubjects';
import type { SubjectSuccessRate } from '../../../../../types/documents';
import { failRateTone } from '../../../../SubjectsPanel/failRateTone';

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
  // Inline on the row, not a second line: the chip qualifies the subject beside
  // it, and one extra line per subject turned an eight-row card into sixteen.
  it('sits on the subject row rather than under it', () => {
    seedRate('EBC-PSI', 72, 28);
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    const chip = screen.getByTestId('subject-fail-rate');
    const name = screen.getByText('Počítačové sítě');
    // Same row means the same flex parent, side by side.
    expect(chip.parentElement).toBe(name.parentElement);
  });

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      successRates: {},
      gradeHistory: null,
    } as never);
  });

  it('shows the bare number and explains it once, in a legend over the list', () => {
    // 28 of 100 fail.
    seedRate('EBC-PSI', 72, 28);
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    // The words used to ride on every row — "Prům. neúspěšnost: 28 %" — which
    // at 320px was most of the row, and described the same figure differently
    // from the study plan. The plan's bargain applies here too: number on the
    // row, words once above it.
    expect(screen.getByTestId('subject-fail-rate')).toHaveTextContent(/^\s*28\s*%\s*$/);
    expect(screen.getByTestId('fail-rate-legend')).toBeInTheDocument();
    expect(screen.getByLabelText(/Prům. neúspěšnost:\s*28\s*%/i)).toBeInTheDocument();
  });

  it('leaves the legend out when no row carries a number to explain', () => {
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('fail-rate-legend')).not.toBeInTheDocument();
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

  it('colours the chip with the same band as the study plan, not with ink meant for a solid fill', () => {
    // v5.2.5 on a phone, dark theme: "Management" at 20 % rendered
    // `text-warning-content` (#111827) on `bg-warning/15` over #1f2937, dark
    // ink on a dark tint, invisible. The desktop pill had the same drift three
    // times and was fixed with `failRateTone`; the phone never adopted it.
    for (const [fail, band] of [
      [22, 'text-[var(--tone-warning)]'],
      [28, 'text-[var(--tone-error)]'],
    ] as const) {
      seedRate('EBC-PSI', 100 - fail, fail);
      const { unmount } = render(
        <SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />
      );
      const chip = screen.getByTestId('subject-fail-rate');
      expect(chip.className).toContain(failRateTone(fail));
      expect(chip.className).toContain(band);
      expect(chip.className).not.toContain('text-warning-content');
      expect(chip.className).not.toMatch(/(^|\s)text-error(\s|$)/);
      unmount();
    }
  });

  it('suppresses a rate computed from too few students', () => {
    // computeFailRate returns null below 10 results — a 50 % drawn from two
    // people is noise presented as a warning.
    seedRate('EBC-PSI', 3, 3);
    render(<SemesterCard enrolled={[enrolledOf(subj())]} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('subject-fail-rate')).not.toBeInTheDocument();
  });
});
