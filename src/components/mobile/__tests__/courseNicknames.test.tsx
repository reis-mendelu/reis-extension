import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../hooks/ui/useRecentPdfOpen', () => ({
  useRecentPdfOpen: () => ({ openRecentPdf: vi.fn(), isOpening: false }),
}));

import { AgendaEvent } from '../screens/calendar/AgendaEvent';
import { WeekBlock } from '../screens/calendar/WeekBlock';
import { NowNextCard } from '../screens/calendar/NowNextCard';
import { RecentFilesStrip } from '../screens/calendar/RecentFilesStrip';
import { SemesterCard } from '../screens/subjects/SemesterCard';
import { ExamsScreen } from '../screens/ExamsScreen';
import { SearchSubjectResults } from '../sheets/search/SearchSubjectResults';
import { useAppStore } from '../../../store/useAppStore';
import { makeLesson } from '../../../test/fixtures/lesson';
import type { SubjectStatus } from '../../../types/studyPlan';
import type { ExamSubject } from '../../../types/exams';
import type { SearchResult } from '../../SearchBar/types';

/**
 * A subject the student renamed reads by that name everywhere the phone prints
 * it, as it does on the extension. The phone tree used to print the IS name at
 * every one of these sites, so a nickname set in the extension never showed
 * here, and there was no way to set one here either.
 */
const NICKNAMES = { 'EBC-MAN': 'Mňam', 'EBC-ALG': 'Algo' };

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    courseNicknames: NICKNAMES,
    successRates: {},
    gradeHistory: null,
  } as never);
});

describe('calendar', () => {
  it('agenda row', () => {
    render(<AgendaEvent lesson={makeLesson()} onOpenSubject={vi.fn()} onShowOnMap={vi.fn()} />);
    expect(screen.getByText('Mňam')).toBeInTheDocument();
    expect(screen.queryByText('Management')).toBeNull();
  });

  it('week grid block', () => {
    const block = { lesson: makeLesson(), top: 0, height: 20, lane: 0, lanes: 1, visible: 20 };
    render(<WeekBlock block={block} cascade={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('Mňam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Mňam,/ })).toBeInTheDocument();
  });

  it('exam block keeps its section after the nickname', () => {
    const lesson = makeLesson({ courseName: 'Management - Zkouška', isExam: true });
    const block = { lesson, top: 0, height: 20, lane: 0, lanes: 1, visible: 20 };
    render(<WeekBlock block={block} cascade={false} gridPx={600} onOpen={vi.fn()} />);
    expect(screen.getByText('Mňam - Zkouška')).toBeInTheDocument();
  });

  it('now/next card names both lessons by their nicknames', () => {
    render(
      <NowNextCard
        data={{
          current: makeLesson(),
          next: makeLesson({ id: 'l2', courseCode: 'EBC-ALG', courseName: 'Algoritmizace' }),
          elapsedPct: 10,
          minutesLeft: 50,
        }}
        onRoute={vi.fn()}
      />
    );
    expect(screen.getByText('Mňam')).toBeInTheDocument();
    expect(screen.getByText(/Algo · Q01/)).toBeInTheDocument();
    expect(screen.queryByText(/Algoritmizace/)).toBeNull();
  });

  it('recently opened files name their subject by its nickname', () => {
    useAppStore.setState({
      subjects: {
        version: 1,
        lastUpdated: '',
        data: { 'EBC-MAN': { displayName: 'Management' } },
      },
      recentPdfs: [
        { key: 'a', courseCode: 'EBC-MAN', link: 'x', name: 'Skripta', date: '', lastOpenedAt: 1 },
      ],
      dismissRecentPdf: vi.fn(),
    } as never);
    render(<RecentFilesStrip />);
    expect(screen.getByText('Mňam')).toBeInTheDocument();
  });
});

describe('subjects screen', () => {
  it('semester row', () => {
    const subject: SubjectStatus = {
      id: '1',
      code: 'EBC-MAN',
      name: 'Management',
      credits: 5,
      type: 'zk',
      isEnrolled: true,
      isFulfilled: false,
      enrollmentCount: 1,
      rawStatusText: '',
    };
    render(
      <SemesterCard
        enrolled={[{ subject, semester: 3, done: false }]}
        semester={3}
        onOpenSubject={vi.fn()}
      />
    );
    expect(screen.getByText('Mňam')).toBeInTheDocument();
    expect(screen.queryByText('Management')).toBeNull();
  });
});

describe('exams screen', () => {
  const term = { id: 't1', date: '24.09.2026', time: '09:00', room: 'Q01' };
  const exam = (code: string, name: string, status: 'registered' | 'available'): ExamSubject =>
    ({
      version: 1,
      id: code,
      name,
      code,
      sections: [
        {
          id: `${code}-s`,
          name: 'zkouška',
          type: 'exam',
          status,
          registeredTerm: status === 'registered' ? term : undefined,
          terms: [{ ...term, id: `${code}-t`, canRegisterNow: true }],
        },
      ],
    }) as ExamSubject;

  it('registered and open exams carry the nickname', () => {
    useAppStore.setState({
      now: new Date(2026, 8, 22, 12, 0),
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      exams: {
        data: [
          exam('EBC-MAN', 'Management', 'registered'),
          exam('EBC-ALG', 'Algoritmizace', 'available'),
        ],
        status: 'success',
        error: null,
      },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
    } as never);
    render(<ExamsScreen />);
    expect(screen.getAllByText('Mňam').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Algo').length).toBeGreaterThan(0);
    expect(screen.queryByText('Management')).toBeNull();
    expect(screen.queryByText('Algoritmizace')).toBeNull();
  });
});

describe('search', () => {
  const result: SearchResult = {
    id: '1',
    title: 'Management',
    type: 'subject',
    detail: 'EBC-MAN',
    subjectCode: 'EBC-MAN',
  };

  it('a result for a renamed subject shows the nickname, and opens with the IS one', () => {
    const openSubject = vi.fn();
    render(
      <SearchSubjectResults
        subjectResults={[result]}
        shownSubjects={[]}
        hasQuery
        canSearchPeople
        searchingPeople={false}
        scope="faculty"
        canScopeToFaculty={false}
        widenToUniversity={vi.fn()}
        narrowToFaculty={vi.fn()}
        openSubject={openSubject}
        selectedIndex={-1}
        optionId={(i) => `o${i}`}
        noResultsText=""
      />
    );
    const row = screen.getByText('Mňam');
    row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(openSubject).toHaveBeenCalledWith(result);
  });
});
