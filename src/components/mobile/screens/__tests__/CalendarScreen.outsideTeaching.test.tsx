import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

/**
 * Which day the calendar LANDS on before term.
 *
 * Saying "Výuka začíná 21. 9." under an empty day is true but still leaves the
 * student on a screen with nothing in it — "it looks to people like their
 * calendar is broken". So before term the calendar opens on the first teaching
 * day instead of on today, where there is an actual schedule to see.
 *
 * Only ever a DEFAULT: the moment a day is chosen — including by the Dnes pill,
 * which is visible on landing precisely because the screen is not showing today
 * — the choice wins.
 */
describe('CalendarScreen landing day', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      // Nothing chosen yet — this is what a cold open looks like.
      mobileSelectedDayIso: null,
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

  it('opens on the first teaching day when term has not started', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Pondělí 21. září')).toBeInTheDocument();
  });

  it('shows the lesson that day rather than an empty screen', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-outside-teaching')).not.toBeInTheDocument();
  });

  it('offers the way back to today, and it goes to today', () => {
    // fireEvent, not userEvent: userEvent's own timers deadlock against the
    // fake clock this suite needs to pin a date before term.
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));
    expect(screen.getByText('Středa 16. září')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-outside-teaching')).toBeInTheDocument();
  });

  it('stays on today once teaching is running, even if today holds no lesson', () => {
    // Tuesday of week 1. Teaching is running and the student simply has nothing
    // on — landing them on Monday's class would be teleporting them off a real
    // teaching day.
    vi.setSystemTime(new Date('2026-09-22T10:00:00'));
    render(<CalendarScreen />);
    expect(screen.getByText('Úterý 22. září')).toBeInTheDocument();
  });

  it('stays on today on the first teaching day itself', () => {
    // The boundary. 21. 9. is both today and the first lesson, so nothing
    // moves — and `isOutsideTeaching` is already false, which is what decides.
    vi.setSystemTime(new Date('2026-09-21T08:00:00'));
    render(<CalendarScreen />);
    expect(screen.getByText('Pondělí 21. září')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dnes' })).not.toBeInTheDocument();
  });

  it('stays on today mid-week once term is running, with the ordinary empty state', () => {
    // Wednesday of teaching week 1. The student has no lesson that day, but
    // teaching IS running — so this is an ordinary free day, not the gap
    // before term, and it must not be dragged back to Monday's class.
    vi.setSystemTime(new Date('2026-09-23T10:00:00'));
    render(<CalendarScreen />);
    expect(screen.getByText('Středa 23. září')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-outside-teaching')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dnes' })).not.toBeInTheDocument();
  });

  it('stays on today after term, when the first lesson is in the past', () => {
    vi.setSystemTime(new Date('2026-12-16T10:00:00'));
    render(<CalendarScreen />);
    expect(screen.getByText('Středa 16. prosince')).toBeInTheDocument();
  });

  it('stays on today while the teaching-week table has not arrived', () => {
    // A late fetch must not silently move the student to another week.
    useAppStore.setState({ teachingWeekData: null } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('Středa 16. září')).toBeInTheDocument();
  });

  it('stays on today with no schedule to name a first day', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success' } } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('Středa 16. září')).toBeInTheDocument();
  });
});
