import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The header outlives every screen's loading and error gate — not just the
 * calendar's.
 *
 * CalendarScreen.header.test.tsx fixed this for one screen. Exams and Subjects
 * kept the same shape: `return <XSkeleton />` and `return <ScreenError />`
 * BEFORE rendering `ScreenHeader`, which owns the shared actions. So on a slow
 * first sync, or after a failed fetch, two of the four tabs still had no route
 * to the vývěska, search or notifications — the very hole the header was moved
 * into `ScreenHeader` to make impossible. Caught in review on this PR.
 */
const ACTIONS = ['Rozbalit vývěsku', 'Hledat', 'Oznámení'];

const LOADING = {
  isSyncing: true,
  lastSync: null,
  error: null,
  handshakeDone: true,
  handshakeTimedOut: false,
};
const FAILED = {
  isSyncing: false,
  lastSync: 1,
  error: 'boom',
  handshakeDone: true,
  handshakeTimedOut: false,
};

describe('the header survives the loading and error gates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      firstSyncSettled: false,
      syncLoaded: {},
      exams: { data: [], status: 'loading', error: null } as never,
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
      studyPlanDual: null,
      studyStats: null,
      studyComparison: null,
      gradeHistory: null,
      syncStatus: LOADING,
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('keeps them while exams are loading', () => {
    render(<ExamsScreen />);
    expect(screen.getByTestId('exams-skeleton')).toBeInTheDocument();
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('keeps them when the exam fetch failed', () => {
    useAppStore.setState({ firstSyncSettled: true, syncLoaded: {}, syncStatus: FAILED } as never);
    render(<ExamsScreen />);
    expect(screen.getByTestId('exams-error')).toBeInTheDocument();
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('keeps them while subjects are loading', () => {
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('keeps them when the study plan failed to load', () => {
    useAppStore.setState({ firstSyncSettled: true, syncLoaded: {}, syncStatus: FAILED } as never);
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-error')).toBeInTheDocument();
    for (const label of ACTIONS) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('does not stack a second safe-area inset under either header', () => {
    render(<ExamsScreen />);
    expect(screen.getByTestId('exams-skeleton').className).not.toContain('--safe-top');
  });
});
