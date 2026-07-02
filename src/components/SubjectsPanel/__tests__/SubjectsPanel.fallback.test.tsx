import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { StudyPlan } from '@/types/studyPlan';
import type { SubjectsData } from '@/types/documents';

// EnrolledNowSection has deep child deps (SubjectRow etc.) — replace with a
// marker that exposes which subject codes it received.
vi.mock('../EnrolledNowSection', () => ({
  EnrolledNowSection: ({ plan }: { plan: StudyPlan }) => (
    <div data-testid="enrolled-now">
      {plan.blocks.flatMap(b => b.groups.flatMap(g => g.subjects.map(s => s.code))).join(',')}
    </div>
  ),
}));
// Avoid the success-rate batch fetch effect inside useSubjectsData.
vi.mock('../useSubjectsData', () => ({
  useSubjectsData: () => ({
    zameraniLookup: new Map(), subjectSemesters: new Map(), subjectToZameranis: new Map(),
    zameraniProgress: new Map(), failRates: {}, enrolledCredits: 0,
  }),
}));

import { SubjectsPanel } from '../index';
import { useAppStore } from '@/store/useAppStore';

const subjects: SubjectsData = {
  version: 1,
  lastUpdated: '2026-07-02T00:00:00.000Z',
  data: {
    'EBC-ST': {
      displayName: 'Statistika', fullName: 'EBC-ST Statistika', nameCs: 'Statistika', nameEn: 'Statistics',
      subjectCode: 'EBC-ST', subjectId: '123456',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1', fetchedAt: '',
    },
  },
};

const emptyPlan: StudyPlan = {
  title: 'Empty', isFulfilled: false, creditsAcquired: 0, creditsRequired: 0,
  blocks: [{ title: '1. semestr', groups: [{ name: 'G', statusDescription: '', subjects: [] }] }],
};

function setStore(overrides: { plan?: StudyPlan | null; subjects?: SubjectsData | null; studyPlanLoaded?: boolean }) {
  useAppStore.setState({
    language: 'en',
    studyPlanDual: overrides.plan ? { cz: overrides.plan, en: overrides.plan } : null,
    studyPlanLoaded: overrides.studyPlanLoaded ?? true,
    subjects: overrides.subjects ?? null,
    syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true, handshakeTimedOut: false, isSyncing: false },
  });
}

function renderPanel() {
  return render(
    <SubjectsPanel onOpenSubject={() => {}} onSearchSubject={() => {}} onOpenStudyPlan={() => {}} />
  );
}

beforeEach(() => {
  setStore({ plan: null, subjects: null });
});

describe('SubjectsPanel Erasmus fallback', () => {
  it('renders the fallback card from the subjects store when the plan is null', () => {
    setStore({ plan: null, subjects });
    renderPanel();
    expect(screen.getByTestId('enrolled-now').textContent).toBe('EBC-ST');
  });

  it('renders the fallback when the plan exists but has zero subjects', () => {
    setStore({ plan: emptyPlan, subjects });
    renderPanel();
    expect(screen.getByTestId('enrolled-now').textContent).toBe('EBC-ST');
  });

  it('shows the exchange caption and hides the Study Plan button in fallback mode', () => {
    setStore({ plan: null, subjects });
    renderPanel();
    expect(screen.getByText(/exchange studies/i)).toBeTruthy();
    expect(screen.queryByText('Study Plan')).toBeNull();
  });

  it('still shows the noData empty state when both plan and subjects are missing', () => {
    setStore({ plan: null, subjects: null });
    renderPanel();
    expect(screen.getByText('No study plan data')).toBeTruthy();
    expect(screen.queryByTestId('enrolled-now')).toBeNull();
  });

  it('renders the skeleton, not the fallback, when subjects are present but the plan has not settled yet', () => {
    setStore({ plan: null, subjects, studyPlanLoaded: false });
    renderPanel();
    expect(screen.queryByTestId('enrolled-now')).toBeNull();
    expect(screen.queryByText(/exchange studies/i)).toBeNull();
  });
});
