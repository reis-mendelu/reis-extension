import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoisted so the vi.mock factories (which are hoisted above imports) can use them.
const { prefillSpy, plan } = vi.hoisted(() => ({
  prefillSpy: vi.fn(),
  plan: {
    title: 'Test plan', isFulfilled: false, creditsAcquired: 0, creditsRequired: 180,
    blocks: [{
      title: 'Semester 1',
      groups: [{
        name: 'Required', statusDescription: '', subjects: [
          { id: '', code: 'EBC-ST', name: 'Statistika', credits: 5, type: 'P', isEnrolled: false, isFulfilled: false, enrollmentCount: 0, rawStatusText: '' },
        ],
      }],
    }],
  },
}));

// SearchBar: register the prefill spy into prefillRef like the real component does, render a marker.
vi.mock('../../SearchBar/index', () => ({
  SearchBar: ({ prefillRef }: { prefillRef?: React.MutableRefObject<((q: string) => void) | null> }) => {
    React.useEffect(() => { if (prefillRef) prefillRef.current = prefillSpy; });
    return <div data-testid="study-plan-search" />;
  },
}));

// SemesterSection: expose the onSearchSubject it receives via a clickable button.
vi.mock('../SemesterSection', () => ({
  SemesterSection: ({ onSearchSubject }: { onSearchSubject: (n: string) => void }) => (
    <button onClick={() => onSearchSubject('Statistika')}>mock-row-search</button>
  ),
}));

// Keep the rest of the page light and deterministic.
vi.mock('@/hooks/useStudyPlan', () => ({ useStudyPlan: () => plan }));
vi.mock('../useSubjectsData', () => ({ useSubjectsData: () => ({ zameraniLookup: new Map(), subjectSemesters: new Map(), subjectToZameranis: new Map(), zameraniProgress: new Map(), failRates: {}, enrolledCredits: 0 }) }));
vi.mock('../useOpenSemesters', () => ({ useOpenSemesters: () => ({ openSemesters: new Set(), currentSemesterRef: { current: null }, handleToggle: () => {} }) }));
vi.mock('../useZameraniPicks', () => ({ useZameraniPicks: () => ({ effectivePicks: [], togglePick: () => {} }) }));
vi.mock('../insights', () => ({ topHardestUpcoming: () => [], zameraniInsights: () => [] }));

import { StudyPlanPage } from '../StudyPlanPage';
import { useAppStore } from '@/store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ language: 'en', successRates: {} });
  prefillSpy.mockClear();
});

describe('StudyPlanPage on-page search', () => {
  it('renders the search box in the header', () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    expect(screen.getByTestId('study-plan-search')).toBeTruthy();
  });

  it('routes a subject row "Click to search" into the on-page search prefill', async () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    await userEvent.click(screen.getByText('mock-row-search'));
    expect(prefillSpy).toHaveBeenCalledWith('Statistika');
  });
});
