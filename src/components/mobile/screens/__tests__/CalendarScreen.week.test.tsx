import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The week grid: the whole week at a glance, a column per day the strip shows,
 * lessons as blocks. Approved from mockups on 2026-10-03 — what a block says
 * is the subject's NAME and its room ("nobody cares about the code").
 */
describe('CalendarScreen — week view', () => {
  const base = {
    courseId: '',
    roomStructured: { name: '', id: '' },
    teachers: [],
    periodId: '',
    studyId: '',
    campus: '',
    isDefaultCampus: 'true',
    facultyCode: '',
    isSeminar: 'false',
    isConsultation: 'false',
  };
  const java = {
    ...base,
    id: 'pj',
    date: '20261007',
    startTime: '15:00',
    endTime: '16:50',
    courseName: 'Programovací jazyk Java',
    courseCode: 'EBC-PJ',
    room: 'Q07',
  };
  const economics = {
    ...base,
    id: 'pe',
    date: '20261006',
    startTime: '07:00',
    endTime: '08:50',
    courseName: 'Podniková ekonomika 1',
    courseCode: 'EBC-PE',
    room: 'Q01',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
    useAppStore.setState({
      // The store's clock is a singleton the DayChips today mark reads; set it
      // with the system time so no test inherits another's day.
      now: new Date('2026-10-07T10:00:00'),
      language: 'cz',
      mobileSelectedDayIso: '2026-10-07',
      mobileSheets: [],
      mobileTab: 'calendar',
      mobileCalendarView: 'day',
      savedCalendarView: 'day',
      calendarViewChosen: true,
      schedule: { data: [java, economics], status: 'success' },
      customEvents: [],
      hiddenItems: { courses: [], events: [] },
      teachingWeekData: null,
      firstSyncSettled: true,
      syncLoaded: { schedule: true },
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  /**
   * Saturday 3 October 2026: the arrow took the week view to Friday 9, drew
   * it as the strip's only pill, and the student read it as today. The week
   * view marks today and nothing else; the arrow back lands on today.
   */
  it('marks only today in the week view, and the arrow back lands on it', () => {
    vi.setSystemTime(new Date('2026-10-03T16:00:00'));
    useAppStore.setState({
      now: new Date('2026-10-03T16:00:00'),
      mobileSelectedDayIso: null,
      mobileCalendarView: 'week',
    } as never);
    render(<CalendarScreen />);
    const strip = screen.getByTestId('day-strip');
    const pills = () => strip.querySelectorAll('button[class*="bg-primary/15"]');

    fireEvent.click(screen.getByRole('button', { name: 'Další týden' }));
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-09');
    expect(pills()).toHaveLength(0);
    // The grid shows the lessons; the strip's dots would only repeat it.
    expect(within(strip).queryAllByTestId('day-chip-lessons')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Předchozí týden' }));
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-03');
    expect(within(strip).getByRole('button', { name: /\b3\b/ })).toHaveAttribute(
      'aria-current',
      'date'
    );
    expect(pills()).toHaveLength(0);
  });

  // Spec 2026-10-09: the view is chosen once and changed in Profile →
  // Nastavení, so the calendar carries no switch in either view.
  it('has no view switch on the calendar', () => {
    const { unmount } = render(<CalendarScreen />);
    expect(screen.queryByRole('group', { name: 'Zobrazení kalendáře' })).toBeNull();
    unmount();
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    expect(screen.queryByRole('group', { name: 'Zobrazení kalendáře' })).toBeNull();
  });

  it('shows the whole week: a lesson on another day is on screen', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('Podniková ekonomika 1')).toBeTruthy();
    expect(screen.getByText('Programovací jazyk Java')).toBeTruthy();
  });

  it('a block says the subject name and the room, not the code', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    const block = screen.getByRole('button', { name: /Programovací jazyk Java/ });
    expect(within(block).getByText('Q07')).toBeTruthy();
    expect(within(block).queryByText('EBC-PJ')).toBeNull();
  });

  it('tapping a block opens the subject, as an agenda row does', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Programovací jazyk Java/ }));
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-PJ',
    });
  });

  /**
   * Týden is about the week, not a day in it — 10 October 2026. A chip tap
   * used to peek into Den, then briefly selected a day; swiping to another week
   * selected one nobody chose, and the chef hat silently depended on it. Now
   * nothing in Týden is selected, a chip is not a control, and the title names
   * the week the strip shows.
   */
  it('a day in the strip is not a control in the week view', () => {
    useAppStore.setState({ mobileCalendarView: 'week', savedCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    const chip = within(screen.getByTestId('day-strip')).getByRole('button', { name: /Út 6/ });
    expect(chip).toBeDisabled();
    expect(chip).not.toHaveAttribute('aria-pressed');
    fireEvent.click(chip);
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-07');
  });

  it('the week view is titled with the week the strip shows', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('5.–9. 10.')).toBeInTheDocument();
  });

  // The way back is about the WEEK in Týden: a week holding today is home.
  it('offers the way back only in a week without today', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    const { unmount } = render(<CalendarScreen />);
    expect(screen.queryByLabelText(/Zpět na dnešek/)).toBeNull();
    unmount();
    useAppStore.setState({ mobileSelectedDayIso: '2026-10-14' } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('12.–16. 10.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Zpět na dnešek/)).toBeInTheDocument();
  });

  it('the Now/Next card belongs to the day view', () => {
    vi.setSystemTime(new Date('2026-10-07T15:30:00'));
    useAppStore.setState({ mobileCalendarView: 'week', now: new Date() } as never);
    render(<CalendarScreen />);
    expect(screen.queryByTestId('now-next-card')).toBeNull();
  });
});
