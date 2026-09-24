import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject, ExamTerm } from '../../../../types/exams';

const NOW = new Date(2026, 8, 21, 18, 0); // Monday 21 Sep 2026, evening

function registered(id: string, name: string, date: string, time: string): ExamSubject {
  const term = { id: `${id}-t`, date, time, room: 'Q01' };
  return {
    version: 1,
    id,
    name,
    code: id,
    sections: [
      {
        id: `${id}-s`,
        name: 'zkouška',
        type: 'exam',
        status: 'registered',
        registeredTerm: term,
        terms: [term],
      },
    ],
  } as ExamSubject;
}

/**
 * A registered exam that has been sat stays in IS until it is graded, and the
 * phone treated it as still to come: first in "Co tě čeká", under "Přihlášené
 * · později", counted in "2 přihlášené", with an "Odhlásit" button.
 */
describe('registered exams that have already taken place', () => {
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
        data: [
          registered('pyt', 'Programování v Pythonu', '18.09.2026', '13:00'),
          registered('mat', 'Matematika', '23.09.2026', '09:00'),
        ],
        status: 'success',
        error: null,
      },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
    } as never);
  });

  it('are not shown anywhere on the screen', () => {
    render(<ExamsScreen />);
    expect(screen.queryByText('Programování v Pythonu')).not.toBeInTheDocument();
    // The one still to come is untouched.
    expect(screen.getAllByText('Matematika').length).toBeGreaterThan(0);
  });

  it('are not counted as registered', () => {
    render(<ExamsScreen />);
    expect(screen.getByText('1 přihlášený')).toBeInTheDocument();
  });
});

/**
 * The phone offered "Odhlásit" whatever the date. IS closes deregistration at
 * `deregistrationDeadline` — the desktop panel has always said "Po termínu,
 * nelze se odhlásit" after it — so a tap past the deadline could only fail.
 */
describe('unregistering after the deregistration deadline', () => {
  function withDeadline(deadline: string) {
    const subj = registered('mat', 'Matematika', '23.09.2026', '09:00');
    const term = { ...subj.sections[0]!.registeredTerm!, deregistrationDeadline: deadline };
    subj.sections[0]!.registeredTerm = term;
    subj.sections[0]!.terms = [term as ExamTerm];
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
      exams: { data: [subj], status: 'success', error: null },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
    } as never);
  }
  // A registered exam opens from its tile in the strip — see RegisteredStrip.
  const open = () =>
    fireEvent.click(
      screen
        .getAllByRole('button')
        .find(
          (b) => b.getAttribute('aria-pressed') !== null && /Matematika/.test(b.textContent ?? '')
        )!
    );

  it('says it can no longer be done, instead of offering the button', () => {
    withDeadline('20.09.2026 23:59');
    render(<ExamsScreen />);
    open();
    expect(screen.queryByRole('button', { name: 'Odhlásit' })).not.toBeInTheDocument();
    expect(screen.getByText('Po termínu, nelze se odhlásit')).toBeInTheDocument();
  });

  it('still offers it before the deadline', () => {
    withDeadline('22.09.2026 23:59');
    render(<ExamsScreen />);
    open();
    expect(screen.getByRole('button', { name: 'Odhlásit' })).toBeInTheDocument();
  });
});
