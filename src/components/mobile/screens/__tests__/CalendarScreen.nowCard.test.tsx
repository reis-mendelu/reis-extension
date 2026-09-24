import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

const lesson = (start: string, end: string, name: string) => ({
  id: name,
  date: '20260420',
  startTime: start,
  endTime: end,
  courseCode: 'EBC-X',
  courseName: name,
  room: 'Q01',
  teachers: [{ fullName: 'Ing. Jan Novák', shortName: 'Novák', id: '1' }],
});

/**
 * The running-lesson hero reads the store's clock, not `new Date()`. The store
 * clock is the one the pulse advances, so the card follows it and the
 * countdown moves; the wall clock was read once per render and then only
 * changed when something else did.
 */
describe('CalendarScreen — the running-lesson card', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T23:30:00'));
    useAppStore.setState({
      language: 'cz',
      now: new Date('2026-04-20T10:30:00'),
      mobileSelectedDayIso: '2026-04-20',
      mobileSheets: [],
      schedule: {
        data: [lesson('09:55', '11:25', 'Finanční analýza'), lesson('11:50', '13:20', 'Marketing')],
        status: 'success',
      } as never,
      firstSyncSettled: true,
      syncLoaded: { schedule: true },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('shows the lesson that is running on the store clock', () => {
    render(<CalendarScreen />);
    const hero = within(screen.getByTestId('now-next-card'));
    expect(hero.getByText(/Finanční analýza/)).toBeInTheDocument();
    expect(hero.getByText(/55 min/)).toBeInTheDocument();
  });

  it('follows the store clock when it moves', () => {
    const { rerender } = render(<CalendarScreen />);
    useAppStore.setState({ now: new Date('2026-04-20T12:00:00') } as never);
    rerender(<CalendarScreen />);
    const hero = within(screen.getByTestId('now-next-card'));
    expect(hero.getByText(/Marketing/)).toBeInTheDocument();
    expect(hero.getByText(/80 min/)).toBeInTheDocument();
  });
});
