import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject } from '../../../../types/exams';

const NOW = new Date(2026, 10, 1); // 1 Nov 2026

function subject(sections: ExamSubject['sections']): ExamSubject {
  return { version: 1, id: 'sub-1', name: 'Ekonometrie 1', code: 'EBC-EK1', sections };
}

/**
 * "Otevřené termíny 2" was counting sections nobody could register for: every
 * non-registered section landed in that group, opening date or not. Reported as
 * "Přidat možnost, že zkouška ještě není otevřena".
 */
describe('exams that have not opened for registration yet', () => {
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
      exams: { data: [], status: 'success', error: null },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
    });
  });

  it('lists them in their own group, with the date on the term the date belongs to', () => {
    useAppStore.setState({
      exams: {
        data: [
          subject([
            {
              id: 'sec-1',
              name: 'Průběžný test 1',
              type: 'exam',
              status: 'available',
              terms: [
                {
                  id: 'term-1',
                  date: '15.12.2026',
                  time: '10:25',
                  canRegisterNow: false,
                  registrationStart: '01.12.2026 08:00',
                },
              ],
            },
          ]),
        ],
        status: 'success',
        error: null,
      },
    });
    render(<ExamsScreen />);

    expect(screen.getByText('Ještě neotevřené')).toBeInTheDocument();
    // And it is no longer counted among the bookable ones.
    expect(screen.queryByText('Otevřené termíny')).not.toBeInTheDocument();

    // The opening moment belongs to the term, not to the section: one section
    // hands out terms that open on different days. It therefore rides in the
    // term row's trailing slot — the same slot the register button will take
    // once IS opens it — and appears when the card is opened.
    expect(screen.queryByText(/otevírá se/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ekonometrie 1/ }));
    expect(screen.getByText('otevírá se')).toBeInTheDocument();
    expect(screen.getByText('1. 12. 8:00')).toBeInTheDocument();
  });

  it('leaves a section that really is open where it was', () => {
    useAppStore.setState({
      exams: {
        data: [
          subject([
            {
              id: 'sec-2',
              name: 'Zkouška',
              type: 'exam',
              status: 'available',
              terms: [{ id: 'term-2', date: '15.12.2026', time: '09:00', canRegisterNow: true }],
            },
          ]),
        ],
        status: 'success',
        error: null,
      },
    });
    render(<ExamsScreen />);

    expect(screen.getByText('Otevřené termíny')).toBeInTheDocument();
    expect(screen.queryByText('Ještě neotevřené')).not.toBeInTheDocument();
  });
});
