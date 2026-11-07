import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { SubjectsScreen } from '../SubjectsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { SubjectsData } from '../../../../types/documents';
import type { StudyPlan } from '../../../../types/studyPlan';

// Erasmus/exchange students have no KontrolaPlanu, so the study plan never
// arrives. The extension has fallen back to the subjects store (student/list.pl)
// for them for a long time; the phone showed "Zatím žádné předměty" instead —
// reported on 5 Nov 2026 as "Subjects: list is empty" from an iPhone.

const subjects: SubjectsData = {
  version: 1,
  lastUpdated: '2026-11-01T00:00:00.000Z',
  data: {
    'EBA-MKT': {
      displayName: 'Marketing (display)',
      fullName: 'EBA-MKT Marketing',
      nameCs: 'Marketing CZ',
      nameEn: 'Marketing',
      subjectCode: 'EBA-MKT',
      subjectId: '170001',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1',
      fetchedAt: '',
    },
    'EBA-ECO': {
      displayName: 'Economics',
      fullName: 'EBA-ECO Economics',
      nameCs: 'Ekonomie',
      nameEn: 'Economics',
      subjectCode: 'EBA-ECO',
      subjectId: '170002',
      folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=2',
      fetchedAt: '',
    },
  },
};

const regularPlan: StudyPlan = {
  title: 'Economics and Management · PEF',
  isFulfilled: false,
  creditsAcquired: 60,
  creditsRequired: 180,
  blocks: [
    {
      title: '3. semestr',
      groups: [
        {
          name: 'Povinné',
          statusDescription: '',
          subjects: [
            {
              id: '170001',
              code: 'EBA-MKT',
              name: 'Marketing',
              credits: 6,
              type: 'zk',
              isEnrolled: true,
              isFulfilled: false,
              enrollmentCount: 1,
              rawStatusText: '',
            },
          ],
        },
      ],
    },
  ],
};

// Dominik, 2026-11-07: students only care that they see their subjects, not
// whether IS has a study plan for them, so the fallback says nothing about it.
const CAPTION = /study plan isn't available|exchange stud/i;

function settled(overrides: Record<string, unknown> = {}) {
  useAppStore.setState({
    language: 'en',
    studyPlanDual: null as never,
    studyPlanLoaded: true,
    subjects,
    studyStats: null,
    studyComparison: null,
    successRates: {},
    firstSyncSettled: true,
    syncStatus: {
      isSyncing: false,
      lastSync: 1,
      error: null,
      handshakeDone: true,
      handshakeTimedOut: false,
    },
    ...overrides,
  });
}

describe('SubjectsScreen — exchange students (no study plan)', () => {
  beforeEach(() => settled());

  it('lists the subjects from the subjects store with no caption about the study plan', () => {
    render(<SubjectsScreen />);
    expect(screen.queryByText(CAPTION)).not.toBeInTheDocument();
    expect(screen.queryByTestId('subjects-exchange-caption')).not.toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Economics')).toBeInTheDocument();
    expect(screen.queryByText('No courses yet')).not.toBeInTheDocument();
  });

  it('invents no credits, semester or progress', () => {
    render(<SubjectsScreen />);
    expect(screen.queryByText(/credit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\/\d+ done/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Semester/)).not.toBeInTheDocument();
  });

  it('has no Study plan row, since that page would be empty', () => {
    render(<SubjectsScreen />);
    expect(screen.queryByRole('button', { name: /study plan/i })).not.toBeInTheDocument();
  });

  it('shows the fail rate by subject code', () => {
    settled({
      successRates: {
        'EBA-MKT': {
          courseCode: 'EBA-MKT',
          stats: [
            {
              semesterName: 'ZS 2025/2026',
              semesterId: '1',
              year: 2025,
              totalPass: 60,
              totalFail: 40,
              type: 'exam',
              grades: {},
              terms: [],
              sourceUrl: '',
            },
          ],
          lastUpdated: '',
        },
      } as never,
    });
    render(<SubjectsScreen />);
    expect(screen.getAllByTestId('subject-fail-rate').length).toBeGreaterThan(0);
  });

  it('opens the subject drawer for a fallback row', () => {
    render(<SubjectsScreen />);
    fireEvent.click(screen.getByText('Marketing'));
    const top = useAppStore.getState().mobileSheets.at(-1) as Record<string, unknown> | undefined;
    expect(top).toMatchObject({ kind: 'subjectDrawer', courseCode: 'EBA-MKT', courseId: '170001' });
  });

  it('keeps the subjects when the tab is reopened during a background resync', () => {
    // The phone unmounts tabs. A latch held in component state would reset, and
    // a resync running at that moment would drop the student on the empty state.
    settled({
      syncStatus: {
        isSyncing: true,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    render(<SubjectsScreen />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.queryByText('No courses yet')).not.toBeInTheDocument();
  });

  it('still shows the empty state when the subjects store is empty too', () => {
    settled({ subjects: null });
    render(<SubjectsScreen />);
    expect(screen.queryByText(CAPTION)).not.toBeInTheDocument();
    expect(screen.getByText('No courses yet')).toBeInTheDocument();
  });
});

describe('SubjectsScreen — regular students never see the fallback list', () => {
  it('shows the skeleton, not the fallback, while the plan is still loading on a cold start', () => {
    // The subjects store hydrates (Tier 1) before the study plan (Tier 2), so
    // for a moment a regular student has subjects and no plan.
    settled({
      studyPlanLoaded: false,
      firstSyncSettled: false,
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    const { rerender } = render(<SubjectsScreen />);
    expect(screen.getByTestId('subjects-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Marketing')).not.toBeInTheDocument();

    act(() => useAppStore.setState({ studyPlanLoaded: true }));
    rerender(<SubjectsScreen />);
    expect(screen.queryByRole('button', { name: /study plan/i })).not.toBeInTheDocument();

    act(() =>
      useAppStore.setState({
        studyPlanDual: { cz: regularPlan, en: regularPlan } as never,
        firstSyncSettled: true,
        syncStatus: {
          isSyncing: false,
          lastSync: 1,
          error: null,
          handshakeDone: true,
          handshakeTimedOut: false,
        },
      })
    );
    rerender(<SubjectsScreen />);
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study plan/i })).toBeInTheDocument();
  });

  it("shows no fallback list after the handshake while the plan's IndexedDB read is still pending", () => {
    settled({ studyPlanLoaded: false });
    render(<SubjectsScreen />);
    expect(screen.queryByText('Marketing')).not.toBeInTheDocument();
  });
});
