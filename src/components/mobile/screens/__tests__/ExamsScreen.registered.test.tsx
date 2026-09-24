import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { ExamSubject } from '../../../../types/exams';

const NOW = new Date(2026, 8, 22, 12, 0); // Tuesday 22 Sep 2026

function registered(id: string, name: string, date: string): ExamSubject {
  const term = { id: `${id}-t`, date, time: '09:00', room: 'Q01' };
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

function open(id: string, name: string): ExamSubject {
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
        status: 'available',
        terms: [{ id: `${id}-t`, date: '15.12.2026', time: '10:00', canRegisterNow: true }],
      },
    ],
  } as ExamSubject;
}

/**
 * Registered exams live in ONE place: a swipeable row of full-width cards at
 * the top, headed "Přihlášené zkoušky". They used to appear twice — a small
 * card in "Co tě čeká" and a second card under "Přihlášené · tento týden /
 * později" — so the same exam was on screen two times, and the detail you
 * needed (Odhlásit, the terms) was in the lower copy, not the one you tapped.
 */
describe('registered exams', () => {
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
          registered('mat', 'Matematika', '24.09.2026'),
          registered('mik', 'Mikroekonomie', '06.10.2026'),
          open('pyt', 'Programování'),
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

  it('are headed "Přihlášené zkoušky", not "Co tě čeká"', () => {
    render(<ExamsScreen />);
    expect(screen.getByText('Přihlášené zkoušky')).toBeInTheDocument();
    expect(screen.queryByText('Co tě čeká')).not.toBeInTheDocument();
    expect(screen.queryByText(/Přihlášené · (tento týden|později)/)).not.toBeInTheDocument();
  });

  // The "2 přihlášené" pill above already says how many; a "2" beside the
  // group title repeated it a few pixels lower.
  it('do not repeat their count beside the group title', () => {
    render(<ExamsScreen />);
    const header = within(screen.getByTestId('exam-group-registered')).getAllByRole('button')[0]!;
    expect(header).toHaveTextContent(/^Přihlášené zkoušky$/);
    expect(screen.getByText('2 přihlášené')).toBeInTheDocument();
  });

  it('each appear once, as a tile in the swipeable strip', () => {
    render(<ExamsScreen />);
    const strip = screen.getByTestId('registered-strip');
    expect(within(strip).getByText('Matematika')).toBeInTheDocument();
    expect(within(strip).getByText('Mikroekonomie')).toBeInTheDocument();
    expect(screen.getAllByText('Matematika')).toHaveLength(1);
  });

  // "Aby se přihlášené zkoušky neukazovaly defaultně" — only the tiles, until
  // one is tapped.
  it('show no detail card until a tile is tapped', () => {
    render(<ExamsScreen />);
    expect(screen.queryByTestId('registered-detail')).not.toBeInTheDocument();
    expect(screen.queryByText('Odhlásit')).not.toBeInTheDocument();
  });

  it('open the tapped exam under the strip, and close it on a second tap', () => {
    render(<ExamsScreen />);
    const tile = within(screen.getByTestId('registered-strip')).getByText('Mikroekonomie');
    fireEvent.click(tile);
    const detail = screen.getByTestId('registered-detail');
    expect(within(detail).getByText('Mikroekonomie')).toBeInTheDocument();
    expect(within(detail).getByText('Odhlásit')).toBeInTheDocument();
    expect(tile.closest('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tile);
    expect(screen.queryByTestId('registered-detail')).not.toBeInTheDocument();
  });

  it('switch the detail when another tile is tapped', () => {
    render(<ExamsScreen />);
    const strip = screen.getByTestId('registered-strip');
    fireEvent.click(within(strip).getByText('Matematika'));
    fireEvent.click(within(strip).getByText('Mikroekonomie'));
    const detail = screen.getByTestId('registered-detail');
    expect(within(detail).getByText('Mikroekonomie')).toBeInTheDocument();
    expect(within(detail).queryByText('Matematika')).not.toBeInTheDocument();
  });

  /**
   * "Nějak viditelně zpracuj otevřené, neotevřené a přihlášené termíny" — each
   * group carries its own colour, on the header and on its cards' accent bar,
   * so a student tells them apart without reading the header.
   */
  it('are told apart from open terms by colour', () => {
    render(<ExamsScreen />);
    expect(screen.getByTestId('exam-group-registered')).toBeInTheDocument();
    expect(screen.getByTestId('exam-group-open')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('registered-strip')).getByText('Matematika'));
    const regAccent = within(screen.getByTestId('registered-detail')).getAllByTestId(
      'exam-accent'
    )[0]!;
    const openAccent = within(screen.getByTestId('exam-group-open')).getAllByTestId(
      'exam-accent'
    )[0]!;
    expect(regAccent.className).toContain('bg-success');
    expect(openAccent.className).toContain('bg-info');
  });
});
