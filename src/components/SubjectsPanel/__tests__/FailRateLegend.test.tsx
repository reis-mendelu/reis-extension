import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { plan } = vi.hoisted(() => ({
  plan: {
    title: 'Test plan',
    isFulfilled: false,
    creditsAcquired: 0,
    creditsRequired: 180,
    blocks: [
      {
        title: 'Semester 1',
        groups: [
          {
            name: 'Required',
            statusDescription: '',
            subjects: [
              {
                id: '',
                code: 'EBC-ST',
                name: 'Statistika',
                credits: 5,
                type: 'P',
                isEnrolled: false,
                isFulfilled: false,
                enrollmentCount: 0,
                rawStatusText: '',
              },
            ],
          },
        ],
      },
    ],
  },
}));

vi.mock('../../SearchBar/index', () => ({
  SearchBar: () => <div />,
}));
vi.mock('../SemesterSection', () => ({ SemesterSection: () => <div /> }));
vi.mock('@/hooks/useStudyPlan', () => ({ useStudyPlan: () => plan }));
vi.mock('../useSubjectsData', () => ({
  useSubjectsData: () => ({
    zameraniLookup: new Map(),
    subjectSemesters: new Map(),
    subjectToZameranis: new Map(),
    zameraniProgress: new Map(),
    failRates: {},
    enrolledCredits: 0,
  }),
}));
vi.mock('../useOpenSemesters', () => ({
  useOpenSemesters: () => ({
    openSemesters: new Set(),
    currentSemesterRef: { current: null },
    handleToggle: () => {},
  }),
}));
vi.mock('../useZameraniPicks', () => ({
  useZameraniPicks: () => ({ effectivePicks: [], togglePick: () => {} }),
}));
vi.mock('../insights', () => ({ topHardestUpcoming: () => [], zameraniInsights: () => [] }));

import { StudyPlanPage } from '../StudyPlanPage';
import { useAppStore } from '@/store/useAppStore';

/**
 * The rows dropped the words "prům. neúspěšnost" to keep only the number, so
 * SOMETHING on the page has to say what that number is. Once, not per row —
 * which is the whole point of the change.
 */
describe('the fail-rate legend', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', successRates: {} });
  });

  it('names the column once on the study plan', () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.getAllByTestId('fail-rate-legend')).toHaveLength(1);
    expect(screen.getByText(/neúspěšnost/i)).toBeInTheDocument();
  });
});
