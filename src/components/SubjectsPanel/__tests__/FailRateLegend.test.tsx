import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { plan, failRates, openSemesters } = vi.hoisted(() => ({
  failRates: { EBC_ST: null } as Record<string, number | null>,
  openSemesters: { current: new Set<number>() },
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
    failRates,
    enrolledCredits: 0,
  }),
}));
vi.mock('../useOpenSemesters', () => ({
  useOpenSemesters: () => ({
    openSemesters: openSemesters.current,
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
 * which is the whole point of the change — and only where the column it names
 * is actually on screen, which is the part review caught: the page opens with
 * every semester collapsed, and a caption over no values explains nothing.
 */
describe('the fail-rate legend', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', successRates: {} });
    for (const k of Object.keys(failRates)) delete failRates[k];
    openSemesters.current = new Set();
  });

  it('names the column once when an open semester shows rates', () => {
    failRates['EBC-ST'] = 28;
    openSemesters.current = new Set([0]);
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.getAllByTestId('fail-rate-legend')).toHaveLength(1);
    expect(screen.getByText(/neúspěšnost/i)).toBeInTheDocument();
  });

  it('stays away while every semester is collapsed', () => {
    failRates['EBC-ST'] = 28;
    openSemesters.current = new Set();
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('fail-rate-legend')).not.toBeInTheDocument();
  });

  it('stays away when an open semester has no rates to show', () => {
    openSemesters.current = new Set([0]);
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.queryByTestId('fail-rate-legend')).not.toBeInTheDocument();
  });
});
