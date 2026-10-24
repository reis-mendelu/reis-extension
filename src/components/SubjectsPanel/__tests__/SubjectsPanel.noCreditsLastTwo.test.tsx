import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyPlan, StudyStats } from '@/types/studyPlan';

vi.mock('../EnrolledNowSection', () => ({ EnrolledNowSection: () => <div /> }));
vi.mock('../useSubjectsData', () => ({
  useSubjectsData: () => ({
    zameraniLookup: new Map(),
    subjectSemesters: new Map(),
    subjectToZameranis: new Map(),
    zameraniProgress: new Map(),
    failRates: {},
    enrolledCredits: 20,
  }),
}));

import { SubjectsPanel } from '../index';
import { useAppStore } from '@/store/useAppStore';

const plan = {
  title: 'Plán',
  isFulfilled: false,
  creditsAcquired: 10,
  creditsRequired: 180,
  blocks: [
    { title: '3', groups: [{ name: 'G', statusDescription: '', subjects: [{ code: 'EBC-PJ' }] }] },
  ],
} as unknown as StudyPlan;

const semester = {
  enrolledCredits: 20,
  earnedCredits: 6,
  unearnedCredits: 0,
  completedSubjects: 2,
  gpa: 2,
  gpaWithFails: 2,
};

const stats: StudyStats = {
  currentSemester: semester,
  previousSemester: null,
  totalEarnedCredits: 6,
  creditsLastTwoPeriods: 47,
  repeatedSubjects: 0,
  registrationVouchersInitial: 0,
  registrationVouchersCurrent: 0,
  gpaTotal: 2,
  weightedGpaTotal: 2,
};

/**
 * The progress card no longer prints "Kredity za poslední 2 semestry: N". IS
 * publishes the count with no minimum, so the figure told a student nothing.
 * Phone half: `CreditRing.test.tsx`.
 */
describe('SubjectsPanel — credits over the last two semesters', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studyPlanDual: { cz: plan, en: plan },
      studyPlanLoaded: true,
      studyStats: stats,
      syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true, isSyncing: false },
    } as never);
  });

  it('does not show the line even when IS reported the figure', () => {
    render(
      <SubjectsPanel
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
        onOpenStudyPlan={() => {}}
      />
    );
    expect(screen.getByText('Plán')).toBeInTheDocument();
    expect(screen.getByText(/kr\. zapsáno/)).toBeInTheDocument();
    expect(screen.queryByText(/poslední 2 semestry/)).not.toBeInTheDocument();
    expect(screen.queryByText(/: 47/)).not.toBeInTheDocument();
  });
});
