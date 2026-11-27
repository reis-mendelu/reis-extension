import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermRow } from '../TermRow';
import { useWatchdog } from '../../../../../hooks/data/useWatchdog';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({ useWatchdog: vi.fn() }));

const NOW = new Date(2026, 10, 25, 12, 0);

/**
 * IS 2026-11-25, EBC-MNG 14.12. 15:00: capacity cell "59/60(1)", action cell
 * with the watchdog and the reason page but no "Přihlásit". The phone showed a
 * green "volno 1 z 60" and an empty status slot, so it looked bookable.
 */
const reserveTerm: ExamTerm = {
  id: '345019',
  date: '14.12.2026',
  time: '15:00',
  capacity: { occupied: 59, total: 60, raw: '59/60(1)', reserve: 1 },
  full: true,
  canRegisterNow: false,
  registrationEnd: '14.12.2026 13:00',
  watchdogUrl: 'https://is.mendelu.cz/watchdog?aktivace=2',
};

const section: ExamSection = {
  id: 's1',
  name: 'Zápočet',
  type: 'test',
  status: 'open',
  terms: [reserveTerm],
};

describe('TermRow — a term whose reserve takes the last seat', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', now: NOW } as never);
    vi.mocked(useWatchdog).mockReturnValue({
      armed: false,
      firing: false,
      feedback: null,
      errorMessage: null,
      toggle: vi.fn(),
    });
  });
  afterEach(cleanup);

  const view = () =>
    render(
      <TermRow
        term={reserveTerm}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );

  it('is full, with no free seat and no register button', () => {
    view();
    expect(screen.getByText('volno 0 z 60')).toBeTruthy();
    expect(screen.getByText('obsazeno')).toBeTruthy();
    expect(screen.queryByText('Přihlásit')).toBeNull();
  });

  it('names the bell: it only watches the term, it does not sign up', () => {
    view();
    expect(screen.getByTestId('watch-toggle').textContent).toContain('Hlídat');
  });
});
