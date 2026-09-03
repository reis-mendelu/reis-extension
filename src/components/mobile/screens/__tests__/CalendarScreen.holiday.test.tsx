import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * State holidays, on the phone.
 *
 * `getCzechHoliday` has existed in `src/utils/holidays.ts` all along —
 * fixed dates plus a Meeus/Jones/Butcher Easter — and only the DESKTOP
 * calendar ever called it (`WeeklyCalendar/useCalendarData`). The phone
 * calendar never did, so on the iPad a public holiday looked like any other
 * empty day: "Nic nemáš, pohodička", as though the student happened to have
 * nothing on. Same divergence as the enrolled-subjects and fail-rate ones —
 * the phone screens were written fresh rather than reusing what the extension
 * already had.
 *
 * 28 September 2026 is Den české státnosti and falls on a Monday, so it lands
 * in the Mon–Fri chip row without needing the weekend branch.
 */
describe('CalendarScreen holidays', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-09-28',
      mobileSheets: [],
      fullName: 'Jana Nováková',
      hiddenItems: { events: [], courses: [] },
      schedule: { data: [], status: 'success' } as never,
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

  it('names the holiday on the selected day', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-holiday')).toHaveTextContent('Den české státnosti');
  });

  it('says it is a public holiday rather than "you have nothing on"', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Státní svátek')).toBeInTheDocument();
    expect(screen.queryByText('Nic nemáš, pohodička')).not.toBeInTheDocument();
  });

  it('leaves an ordinary empty day exactly as it was', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-09-29' } as never);
    render(<CalendarScreen />);
    expect(screen.queryByTestId('calendar-holiday')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('names the holiday in English too', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-holiday')).toHaveTextContent('St. Wenceslas Day');
  });

  it('marks the holiday in the day-chip row, so it is visible before it is selected', () => {
    render(<CalendarScreen />);
    // The whole week is on screen; only the 28th is a holiday.
    const marked = screen.getAllByTestId('day-chip-holiday');
    expect(marked).toHaveLength(1);
  });

  /**
   * Easter Monday moves every year, and it is the one the fixed-date table
   * cannot cover — 6 April 2026.
   */
  it('handles a moving feast, not just the fixed dates', () => {
    vi.setSystemTime(new Date('2026-04-06T10:00:00'));
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-06' } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-holiday')).toHaveTextContent(/Velikonoční pondělí/i);
  });
});
