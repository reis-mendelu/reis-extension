import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';

/**
 * Before term, an empty day says so.
 *
 * "On iPad it should also be clear when the schedule is outside of the semester
 * — when it starts on 21.9. the previous weeks/days should be clear that people
 * shouldn't expect to see schedule."
 *
 * The phone answered every empty day with "Nic nemáš, pohodička", which reads
 * as "you happen to be free" when the truth is "there is no schedule to see
 * yet". The desktop has distinguished these since it shipped, from IS's own
 * teaching-week table in `teachingWeekData` — the phone reuses the same field,
 * the same predicate and the same string.
 */
const TEACHING = {
  weeks: [
    { week: 1, from: '2026-09-21', to: '2026-09-27' },
    { week: 2, from: '2026-09-28', to: '2026-10-04' },
  ],
  total: 2,
};

describe('CalendarScreen outside the teaching period', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-09-03',
      mobileSheets: [],
      hiddenItems: { events: [], courses: [] },
      teachingWeekData: TEACHING,
      schedule: { data: [lesson({ id: 'l1', date: '20260921' })], status: 'success' },
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

  it('says the day is outside the teaching period', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-outside-teaching')).toBeInTheDocument();
    expect(screen.getByText('Mimo výukové období')).toBeInTheDocument();
  });

  it('does not claim the student happens to be free', () => {
    render(<CalendarScreen />);
    expect(screen.queryByText('Nic nemáš, pohodička')).not.toBeInTheDocument();
  });

  it('says when teaching starts, which is the useful half', () => {
    render(<CalendarScreen />);
    expect(screen.getByText(/Výuka začíná 21\.\s*9\./)).toBeInTheDocument();
  });

  it('says it for an earlier week too, not just today', () => {
    // "The previous weeks/days should be clear" — the answer follows the
    // selected day, so paging back keeps saying it.
    useAppStore.setState({ mobileSelectedDayIso: '2026-08-24' } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-outside-teaching')).toBeInTheDocument();
  });

  it('goes back to the ordinary empty state inside the teaching period', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-09-23' } as never);
    render(<CalendarScreen />);
    expect(screen.queryByTestId('calendar-outside-teaching')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('claims nothing while the teaching-week table has not arrived', () => {
    // A late fetch must not be reported as "outside the teaching period".
    useAppStore.setState({ teachingWeekData: null } as never);
    render(<CalendarScreen />);
    expect(screen.queryByTestId('calendar-outside-teaching')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('names a holiday rather than the gap when the day is both', () => {
    // 28 September is Den české státnosti; it also sits in teaching week 2.
    useAppStore.setState({ mobileSelectedDayIso: '2026-09-28' } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-holiday')).toBeInTheDocument();
    expect(screen.getByText('Státní svátek')).toBeInTheDocument();
  });
});
