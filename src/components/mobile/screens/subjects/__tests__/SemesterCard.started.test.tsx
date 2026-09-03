import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemesterCard } from '../SemesterCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { SubjectStatus } from '../../../../../types/studyPlan';
import type { EnrolledSubject } from '../../../../../utils/mobile/enrolledSubjects';

const subject: SubjectStatus = {
  id: '1',
  code: 'EBC-JAVA',
  name: 'Java',
  credits: 6,
  type: 'zk',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: '',
};
const enrolled: EnrolledSubject[] = [{ subject, semester: 3, done: false }];

function seedSchedule(dates: string[]) {
  useAppStore.setState({
    language: 'cz',
    successRates: {},
    gradeHistory: null,
    schedule: { data: dates.map((date) => ({ date })), status: 'success' },
  } as never);
}

/**
 * "Právě běží" was asserted unconditionally, so a student opening the app in
 * the week before term saw their enrolled subjects announced as already
 * running. The answer comes from the schedule — `syncSchedule` stores the whole
 * semester, so the earliest lesson IS the first teaching day — rather than from
 * a hardcoded mid-September date that would drift.
 */
describe('SemesterCard — has term started', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says it is running once teaching has begun', () => {
    vi.setSystemTime(new Date(2026, 9, 20));
    seedSchedule(['20260915', '20261005']);
    render(<SemesterCard enrolled={enrolled} semester={3} onOpenSubject={() => {}} />);
    expect(screen.getByText(/právě běží/i)).toBeInTheDocument();
  });

  it('says when it starts instead of claiming it already has', () => {
    vi.setSystemTime(new Date(2026, 8, 1));
    seedSchedule(['20260915', '20261005']);
    render(<SemesterCard enrolled={enrolled} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByText(/právě běží/i)).not.toBeInTheDocument();
    expect(screen.getByText(/začíná/i)).toBeInTheDocument();
    expect(screen.getByText(/15\./)).toBeInTheDocument();
  });

  it('claims neither when there is no schedule to reason from', () => {
    vi.setSystemTime(new Date(2026, 8, 1));
    seedSchedule([]);
    render(<SemesterCard enrolled={enrolled} semester={3} onOpenSubject={() => {}} />);
    expect(screen.queryByText(/právě běží/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/začíná/i)).not.toBeInTheDocument();
    // The credits are a fact either way.
    expect(screen.getByText(/6 kr\./)).toBeInTheDocument();
  });
});
