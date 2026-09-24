import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject } from '../../../../types/exams';

const NOW = new Date(2026, 8, 22, 12, 0);

const subject = (id: string, name: string, cannotRegister: boolean): ExamSubject =>
  ({
    version: 1,
    id,
    name,
    code: id,
    sections: [
      {
        id: `${id}-s`,
        name: 'zkouška',
        type: 'exam',
        status: 'open',
        terms: [
          {
            id: `${id}-t`,
            date: '14.12.2026',
            time: '11:00',
            registrationStart: '09.11.2026 15:00',
            canRegisterNow: false,
            cannotRegister: cannotRegister || undefined,
          },
        ],
      },
    ],
  }) as ExamSubject;

/**
 * "Chybí nám tam zkoušky, na které se nemůžeme přihlásit" — IS lists them
 * under "Kam se přihlásit nemohu?". They get a group of their own, never
 * "Ještě neotevřené": their dates will not open for this student.
 */
describe('exams the student cannot sign up for', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      now: NOW,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      exams: {
        data: [subject('blk', 'Statistika', true), subject('soon', 'Účetnictví', false)],
        status: 'success',
        error: null,
      },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
    } as never);
  });

  it('are listed in their own "Nelze se přihlásit" group', () => {
    render(<ExamsScreen />);
    const group = screen.getByTestId('exam-group-blocked');
    expect(within(group).getByText('Nelze se přihlásit')).toBeInTheDocument();
    expect(within(group).getByText('Statistika')).toBeInTheDocument();
  });

  it('are not mistaken for terms that open later', () => {
    render(<ExamsScreen />);
    const soon = screen.getByTestId('exam-group-notYetOpen');
    expect(within(soon).getByText('Účetnictví')).toBeInTheDocument();
    expect(within(soon).queryByText('Statistika')).not.toBeInTheDocument();
  });
});
