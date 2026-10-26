import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject } from '../../../../types/exams';

const NOW = new Date(2026, 9, 20, 11, 30); // Tuesday 20 Oct 2026

function withData(data: ExamSubject[]) {
  useAppStore.setState({
    language: 'cz',
    now: NOW,
    firstSyncSettled: true,
    syncLoaded: { exams: true },
    syncStatus: {
      isSyncing: false,
      lastSync: 1,
      error: null,
      handshakeDone: true,
      handshakeTimedOut: false,
    },
    exams: { data, status: 'success', error: null },
    examClassmates: {},
    examClassmatesLoading: {},
    examClassmatesError: {},
    lastExamClassmatesFetchedAt: {},
  } as never);
}

/**
 * Návrhy #33 (iOS 5.4.1): "V části kde mají být zkoušky se mi vůbec nic
 * neukazuje". The report's diagnostics read `examsCount: 1` and its screenshot
 * shows the header over an empty body — no rows and no empty state either.
 *
 * The screen chose its empty state on `exams.length === 0`, but a subject can
 * be present and still yield no row: `stripGroupSignupSections` keeps a subject
 * whose only section was "Zápis na cvičení", and `dropFinished` hides a
 * registered exam whose day is over. Either way the screen must say so.
 */
describe('exam subjects that leave nothing to show', () => {
  beforeEach(() => withData([]));

  it('a subject left with no sections shows the empty state', () => {
    withData([{ version: 1, id: 'tv', name: 'Tělesná výchova', code: 'TV', sections: [] }]);
    render(<ExamsScreen />);
    expect(screen.getByText('Žádné zkoušky')).toBeInTheDocument();
  });

  it('a registered exam that is already over shows the empty state', () => {
    const term = { id: 'mat-t', date: '19.10.2026', time: '09:00', room: 'Q01' };
    withData([
      {
        version: 1,
        id: 'mat',
        name: 'Matematika',
        code: 'MAT',
        sections: [
          {
            id: 'mat-s',
            name: 'zápočtový test',
            type: 'exam',
            status: 'registered',
            registeredTerm: term,
            terms: [term],
          },
        ],
      } as ExamSubject,
    ]);
    render(<ExamsScreen />);
    expect(screen.queryByText('Matematika')).not.toBeInTheDocument();
    expect(screen.getByText('Žádné zkoušky')).toBeInTheDocument();
  });
});
