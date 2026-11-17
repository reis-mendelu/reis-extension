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
    enrolledCredits: 0,
  }),
}));

import { SubjectsPanel } from '../index';
import { useAppStore } from '@/store/useAppStore';
import { NOW, box } from '../../SubmissionBoxes/__tests__/boxFixtures';

const plan = {
  title: 'Plán',
  isFulfilled: false,
  creditsAcquired: 10,
  creditsRequired: 180,
  blocks: [
    { title: '3', groups: [{ name: 'G', statusDescription: '', subjects: [{ code: 'EBC-PJ' }] }] },
  ],
} as unknown as StudyPlan;

const stats = {
  currentSemester: { gpa: 1.22, gpaWithFails: 1.22 },
  gpaTotal: 1.52,
  weightedGpaTotal: 1.53,
} as unknown as StudyStats;

function renderPanel() {
  render(
    <SubjectsPanel onOpenSubject={() => {}} onSearchSubject={() => {}} onOpenStudyPlan={() => {}} />
  );
  return {
    averages: screen.getByText('Studijní průměr').closest('button')!.parentElement!,
    studyPlan: screen.getByText('Studijní plán').closest('button')!,
  };
}

const follows = (a: Element, b: Element) =>
  !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/**
 * Layout (a), decided with Dominik for the Task List bug "Bug v předmětech na
 * notebooku…": an open box beside the average left three cards of three
 * heights and widths under Aktuálně zapsáno. With a box, it spans the width on
 * top, and the average and Studijní plán share one row of two halves under it.
 * jsdom lays nothing out, so this pins the structure; the geometry is in the PR.
 */
describe('SubjectsPanel — layout under Aktuálně zapsáno', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studyPlanDual: { cz: plan, en: plan },
      studyPlanLoaded: true,
      studyStats: stats,
      studyComparison: null,
      syncStatus: { ...useAppStore.getState().syncStatus, handshakeDone: true, isSyncing: false },
      odevzdavarny: [box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' })],
      subjects: { data: { 'EBC-PJ': { subjectId: 'P1' } } },
    } as never);
  });

  it('puts an open box above a row holding the average and Studijní plán side by side', () => {
    const { averages, studyPlan } = renderPanel();
    const summary = screen.getByTestId('submission-boxes-summary');
    expect(follows(summary, averages)).toBe(true);
    expect(summary.className).toContain('w-full');

    const row = screen.getByTestId('subjects-bottom-row');
    expect(row.contains(averages)).toBe(true);
    expect(row.contains(studyPlan)).toBe(true);
    expect(row.contains(summary)).toBe(false);
    expect(row.className).toContain('md:grid-cols-2');
    // Each fills its half: no max-w-xl centring them inside it.
    expect(averages.className).not.toContain('max-w-xl');
    expect(studyPlan.className).not.toContain('max-w-xl');
  });

  it('keeps the average over a centred Studijní plán when no box is open', () => {
    useAppStore.setState({ odevzdavarny: [] } as never);
    const { averages, studyPlan } = renderPanel();
    expect(screen.queryByTestId('submission-boxes-summary')).toBeNull();
    expect(screen.queryByTestId('subjects-bottom-row')).toBeNull();
    expect(averages.className).toContain('max-w-xl');
    expect(studyPlan.className).toContain('max-w-xl');
    expect(follows(averages, studyPlan)).toBe(true);
    // Pinned under the scrolling block, as before the box existed.
    expect(averages.closest('.overflow-y-auto')!.contains(studyPlan)).toBe(false);
  });

  // Handed-in work keeps the card on the extension too: with nothing open it
  // shows just its Odevzdáno part, in the same place an open box would.
  it('shows the card with only handed-in boxes, laid out as with an open one', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Hotovo', isOpen: false, section: 'submitted', fileCount: 1, points: '1' }),
      ],
    } as never);
    const { averages } = renderPanel();
    const summary = screen.getByTestId('submission-boxes-summary');
    expect(summary.textContent).toContain('Odevzdáno (1)');
    expect(screen.getByTestId('subjects-bottom-row').contains(averages)).toBe(true);
  });
});
