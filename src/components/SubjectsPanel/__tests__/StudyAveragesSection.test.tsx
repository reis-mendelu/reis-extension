import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { StudyAveragesSection } from '../StudyAveragesSection';
import { useAppStore } from '../../../store/useAppStore';
import type { StudyStats } from '../../../types/studyPlan';

function makeStats(over: Partial<StudyStats> = {}): StudyStats {
  return {
    currentSemester: { enrolledCredits: 0, earnedCredits: 0, unearnedCredits: 0, completedSubjects: 0, gpa: 1.22, gpaWithFails: 1.22 },
    previousSemester: null,
    totalEarnedCredits: 0,
    creditsLastTwoPeriods: 0,
    repeatedSubjects: 0,
    registrationVouchersInitial: 0,
    registrationVouchersCurrent: 0,
    gpaTotal: 1.52,
    weightedGpaTotal: 1.53,
    ...over,
  };
}

describe('StudyAveragesSection', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en' });
  });

  it('renders the three averages formatted with a Czech decimal comma', () => {
    render(<StudyAveragesSection studyStats={makeStats()} />);
    expect(screen.getByText('1,22')).toBeInTheDocument();
    expect(screen.getByText('1,52')).toBeInTheDocument();
    expect(screen.getByText('1,53')).toBeInTheDocument();
  });

  it('renders nothing when studyStats is null', () => {
    const { container } = render(<StudyAveragesSection studyStats={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when all three averages are zero', () => {
    const stats = makeStats({
      currentSemester: { enrolledCredits: 0, earnedCredits: 0, unearnedCredits: 0, completedSubjects: 0, gpa: 0, gpaWithFails: 0 },
      gpaTotal: 0,
      weightedGpaTotal: 0,
    });
    const { container } = render(<StudyAveragesSection studyStats={stats} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a dash for an individual zero value while still rendering the others', () => {
    const stats = makeStats({ gpaTotal: 0 });
    render(<StudyAveragesSection studyStats={stats} />);
    expect(screen.getByText('1,22')).toBeInTheDocument();
    expect(screen.getByText('1,53')).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument(); // en-dash for the zero
  });
});
