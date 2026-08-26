import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type {
  StudyPlan,
  SubjectStatus,
  StudyStats,
  StudyComparison,
} from '../../../../types/studyPlan';

function subj(overrides: Partial<SubjectStatus> = {}): SubjectStatus {
  return {
    id: '159410',
    code: 'EBC-ALG',
    name: 'Algoritmizace',
    credits: 5,
    type: 'zk',
    isEnrolled: true,
    isFulfilled: false,
    enrollmentCount: 1,
    rawStatusText: '',
    ...overrides,
  };
}

function plan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    title: 'Ekonomická informatika · PEF',
    isFulfilled: false,
    creditsAcquired: 96,
    creditsRequired: 180,
    blocks: [
      {
        title: '4. semestr',
        groups: [{ name: 'Povinné', statusDescription: '', subjects: [subj()] }],
      },
    ],
    ...overrides,
  };
}

function stats(overrides: Partial<StudyStats> = {}): StudyStats {
  return {
    currentSemester: {
      enrolledCredits: 28,
      earnedCredits: 12,
      unearnedCredits: 0,
      completedSubjects: 2,
      gpa: 1.71,
      gpaWithFails: 1.71,
    },
    previousSemester: null,
    totalEarnedCredits: 96,
    creditsLastTwoPeriods: 40,
    repeatedSubjects: 0,
    registrationVouchersInitial: 2,
    registrationVouchersCurrent: 2,
    gpaTotal: 1.8,
    weightedGpaTotal: 1.86,
    ...overrides,
  };
}

function comparison(overrides: Partial<StudyComparison> = {}): StudyComparison {
  return { rank: 34, total: 549, percentile: 10, gpa: 1.8, nextBetterGpa: 1.75, ...overrides };
}

describe('SubjectsScreen', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      studyPlanDual: null,
      studyStats: null,
      studyComparison: null,
      gradeHistory: null,
    } as never);
  });

  it('renders the empty state with no study plan', () => {
    render(<SubjectsScreen />);
    expect(screen.getByText('Zatím žádné předměty')).toBeInTheDocument();
  });

  it('renders the empty state for an unparseable plan (blocks: []) instead of a broken 0 % ring', () => {
    // parseStudyPlanDOM never returns null — when the credits label and
    // subject rows aren't found it returns { creditsAcquired: 0, creditsRequired: 0, blocks: [] }.
    // Erasmus/exchange students in particular hit this shape.
    const emptyPlan = plan({ creditsAcquired: 0, creditsRequired: 0, blocks: [] });
    useAppStore.setState({ studyPlanDual: { cz: emptyPlan, en: emptyPlan } } as never);
    render(<SubjectsScreen />);
    expect(screen.getByText('Zatím žádné předměty')).toBeInTheDocument();
    expect(screen.queryByText('0 / 0 kreditů')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /kreditů/ })).not.toBeInTheDocument();
  });

  it('shows the credit ring for a seeded plan', () => {
    const p = plan();
    useAppStore.setState({ studyPlanDual: { cz: p, en: p } } as never);
    render(<SubjectsScreen />);
    expect(screen.getByText('96 / 180 kreditů')).toBeInTheDocument();
  });

  it('pins the computed ring percentage so an inverted fill fraction fails', () => {
    const p = plan({ creditsAcquired: 96, creditsRequired: 180 });
    useAppStore.setState({ studyPlanDual: { cz: p, en: p } } as never);
    render(<SubjectsScreen />);
    // Math.round((96 / 180) * 100) = 53; the inverted (total/earned) form would yield 188.
    expect(screen.getByRole('img', { name: 'Splněno 53 % kreditů' })).toBeInTheDocument();
  });

  it('keeps the average accordion collapsed by default and reveals the averages on tap', () => {
    const p = plan();
    useAppStore.setState({ studyPlanDual: { cz: p, en: p }, studyStats: stats() } as never);
    render(<SubjectsScreen />);

    expect(screen.queryByText('1,71')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Studijní průměr'));

    expect(screen.getByText('1,71')).toBeInTheDocument();
    expect(screen.getByText('1,80')).toBeInTheDocument();
    expect(screen.getByText('1,86')).toBeInTheDocument();
  });

  it('renders the celebratory topTier copy for a top-quartile percentile', () => {
    const p = plan();
    useAppStore.setState({
      studyPlanDual: { cz: p, en: p },
      studyStats: stats(),
      studyComparison: comparison({ percentile: 10 }),
    } as never);
    render(<SubjectsScreen />);

    fireEvent.click(screen.getByText('Studijní průměr'));

    expect(screen.getByText('Jsi v top 10 % ročníku.')).toBeInTheDocument();
    expect(screen.queryByText(/Překonáváš/)).not.toBeInTheDocument();
  });

  it('renders the "beats X%" copy for a below-top-quartile percentile', () => {
    const p = plan();
    useAppStore.setState({
      studyPlanDual: { cz: p, en: p },
      studyStats: stats(),
      studyComparison: comparison({ percentile: 60 }),
    } as never);
    render(<SubjectsScreen />);

    fireEvent.click(screen.getByText('Studijní průměr'));

    expect(screen.getByText('Překonáváš 40 % studentů ve svém ročníku.')).toBeInTheDocument();
    expect(screen.queryByText(/Jsi v top/)).not.toBeInTheDocument();
  });
});

describe('SubjectsScreen first-sync loading', () => {
  // The study plan arrives in the same Phase 2 push as the schedule, so this
  // screen had the same gap: plan absent because it has not landed yet reads
  // identically to plan absent because the student has none.
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studyPlanDual: null as never,
      firstSyncSettled: false,
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });

  it('keeps the skeleton up while the first sync is still fetching', () => {
    render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
  });

  it('drops the skeleton once that sync has finished', () => {
    useAppStore.setState({
      firstSyncSettled: true,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    render(<SubjectsScreen />);
    expect(screen.queryByTestId('subjects-skeleton')).not.toBeInTheDocument();
  });
});
