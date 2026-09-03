import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { StudyPlan, SubjectStatus } from '../../../../types/studyPlan';

function subj(overrides: Partial<SubjectStatus> = {}): SubjectStatus {
  return {
    id: '1',
    code: 'EBC-ALG',
    name: 'Algoritmizace',
    credits: 5,
    type: 'zk',
    isEnrolled: false,
    isFulfilled: false,
    enrollmentCount: 0,
    rawStatusText: '',
    ...overrides,
  };
}

function planOf(blocks: { title: string; subjects: SubjectStatus[] }[]): StudyPlan {
  return {
    title: 'Ekonomická informatika · PEF',
    isFulfilled: false,
    creditsAcquired: 96,
    creditsRequired: 180,
    blocks: blocks.map((b) => ({
      title: b.title,
      groups: [{ name: 'Povinné', statusDescription: '', subjects: b.subjects }],
    })),
  } as StudyPlan;
}

function seed(plan: StudyPlan) {
  useAppStore.setState({
    language: 'cz',
    mobileSheets: [],
    studyPlanDual: { cz: plan, en: plan },
    studyStats: null,
    studyComparison: null,
    gradeHistory: null,
    firstSyncSettled: true,
    syncStatus: {
      isSyncing: false,
      lastSync: 1,
      error: null,
      handshakeDone: true,
      handshakeTimedOut: false,
    },
  } as never);
}

/**
 * The screen shows what the student CHOSE.
 *
 * It used to render a whole study-plan block — the curriculum — so a semester
 * offering a choice between two courses listed both, and the block itself was
 * picked by inference. Reported from the iPad against the browser extension,
 * which has always shown the enrolled set. See `utils/mobile/enrolledSubjects`
 * for the rules; this covers what reaches the screen.
 */
describe('SubjectsScreen — the enrolled semester', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('shows the subject the student enrolled in, not the one they turned down', () => {
    seed(
      planOf([
        {
          title: '3. semestr',
          subjects: [
            subj({ id: '1', code: 'EBC-JAVA', name: 'Java', isEnrolled: true }),
            subj({ id: '2', code: 'EBC-CPP', name: 'C++' }),
          ],
        },
      ])
    );
    render(<SubjectsScreen />);
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.queryByText('C++')).not.toBeInTheDocument();
  });

  it('names the semester the enrolments are in, not one it inferred', () => {
    seed(
      planOf([
        {
          title: '3. semestr',
          subjects: [subj({ code: 'EBC-STAT', name: 'Statistika', isEnrolled: true })],
        },
        {
          title: '4. semestr',
          subjects: [subj({ code: 'EBC-DIP', name: 'Diplomový seminář' })],
        },
      ])
    );
    render(<SubjectsScreen />);
    expect(screen.getByText(/3\./)).toBeInTheDocument();
    expect(screen.queryByText('Diplomový seminář')).not.toBeInTheDocument();
  });

  it('says so plainly when nothing is enrolled yet', () => {
    // The reporter's own state ("maybe that's because I haven't signed up for
    // the subjects yet"). An honest empty beats a semester picked by guesswork.
    seed(
      planOf([
        {
          title: '3. semestr',
          subjects: [subj({ code: 'A', name: 'Alfa' }), subj({ code: 'B', name: 'Beta' })],
        },
      ])
    );
    render(<SubjectsScreen />);
    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    expect(screen.getByTestId('subjects-none-enrolled')).toBeInTheDocument();
  });

  it('counts subjects passed this semester towards done, and still lists them', () => {
    seed(
      planOf([
        {
          title: '3. semestr',
          subjects: [
            subj({ code: 'EBC-JAVA', name: 'Java', isEnrolled: true }),
            subj({
              code: 'EBC-MAT',
              name: 'Matematika',
              isFulfilled: true,
              enrollmentCount: 1,
              fulfillmentDate: '14.03.2026',
            }),
          ],
        },
      ])
    );
    render(<SubjectsScreen />);
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('Matematika')).toBeInTheDocument();
    // "Hotovo 1 z 2"
    expect(screen.getByText(/1.*2/)).toBeInTheDocument();
  });
});
