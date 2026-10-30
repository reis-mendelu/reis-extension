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

  // Spec 2026-10-30: #493's switch is back on the calendar in both views —
  // hidden in Nastavení (#528), nobody found Týden.
  it('carries the Den/Týden switch in both views', () => {
    const { unmount } = render(<CalendarScreen />);
    expect(screen.getByRole('group', { name: 'Zobrazení kalendáře' })).toBeTruthy();
    unmount();
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    expect(screen.getByRole('group', { name: 'Zobrazení kalendáře' })).toBeTruthy();
  });

  it('switching remembers the view', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
    expect(screen.getByTestId('week-grid')).toBeTruthy();
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
   * Spec 2026-10-30, decision 4: tapping a day in Týden IS the choice to look
   * at that day — Den opens on it and Den is remembered. (Until then a chip
   * was a label here, and before that a peek that left Týden saved.)
   */
  it('tapping a day opens it in Den and remembers Den', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    const chip = within(screen.getByTestId('day-strip')).getByRole('button', { name: /Út 6/ });
    fireEvent.click(chip);
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-06');
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

  // Decision 8: the running lesson, its room and Trasa sit above the grid, and
  // only while a lesson is running — Den's card rule.
  it('shows the Teď strip above the grid while a lesson runs', () => {
    vi.setSystemTime(new Date('2026-10-07T15:30:00'));
    useAppStore.setState({ mobileCalendarView: 'week', now: new Date() } as never);
    render(<CalendarScreen />);
    const strip = screen.getByTestId('week-now-strip');
    expect(within(strip).getByText(/Programovací jazyk Java/)).toBeTruthy();
    expect(within(strip).getByText(/Q07/)).toBeTruthy();
  });

  it('has no Teď strip when nothing is running', () => {
    render(<CalendarScreen />);
    expect(screen.queryByTestId('week-now-strip')).toBeNull();
  });

  // Decision 5: the room is on the block — the code, not the campus in brackets.
  it('a block shows the room without its campus', () => {
    useAppStore.setState({
      mobileCalendarView: 'week',
      schedule: { data: [{ ...java, room: 'Q07 (Brno)' }], status: 'success' },
    } as never);
    render(<CalendarScreen />);
    const block = screen.getByRole('button', { name: /Programovací jazyk Java/ });
    expect(within(block).getByText('Q07')).toBeTruthy();
  });

  // Decision 6: the sheet learns which lesson it came from, only from Týden.
  it('a block opens the subject carrying its lesson', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Programovací jazyk Java/ }));
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-PJ',
      weekLesson: { id: 'pj' },
    });
  });

  // Decision 12: the switch back to Den lands on today in this week…
  it('switching to Den in this week lands on today', () => {
    useAppStore.setState({
      mobileCalendarView: 'week',
      mobileSelectedDayIso: '2026-10-06',
    } as never);
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-07');
  });

  // …and in another week on its first day with lessons (here none: Monday).
  it('switching to Den in another week lands on that week', () => {
    useAppStore.setState({
      mobileCalendarView: 'week',
      mobileSelectedDayIso: '2026-10-14',
    } as never);
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-12');
  });

  it('in a week with lessons, the first lesson day', () => {
    useAppStore.setState({
      mobileCalendarView: 'week',
      mobileSelectedDayIso: '2026-10-14',
      schedule: { data: [{ ...java, id: 'pj2', date: '20261015' }], status: 'success' },
    } as never);
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-15');
  });

  /**
   * Decision 3: a pinch is a shortcut on top of the switch. Pinching in on Den
   * zooms out to Týden; spreading on a day in Týden opens that day in Den.
   * Either way the view is remembered, like every other switch.
   */
  const fingers = (a: [number, number], b: [number, number]) => [
    { identifier: 1, clientX: a[0], clientY: a[1] },
    { identifier: 2, clientX: b[0], clientY: b[1] },
  ];
  const twoFingers = (el: HTMLElement, from: number, to: number) => {
    fireEvent.touchStart(el, { touches: fingers([200 - from, 300], [200 + from, 300]) });
    for (const f of [0.33, 0.66, 1]) {
      const half = from + (to - from) * f;
      fireEvent.touchMove(el, { touches: fingers([200 - half, 300], [200 + half, 300]) });
    }
    fireEvent.touchEnd(el, { touches: [] });
  };

  it('pinching in on Den zooms out to Týden', () => {
    render(<CalendarScreen />);
    twoFingers(screen.getByTestId('calendar-screen'), 120, 40);
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });

  it('spreading on a day in Týden opens that day in Den', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    const tuesday = screen.getByTestId('week-grid').querySelector('[data-day-iso="2026-10-06"]');
    expect(tuesday).toBeTruthy();
    const original = document.elementFromPoint;
    document.elementFromPoint = () => tuesday;
    try {
      twoFingers(screen.getByTestId('calendar-screen'), 40, 120);
    } finally {
      document.elementFromPoint = original;
    }
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-06');
  });

  it('a small two-finger wobble changes nothing', () => {
    render(<CalendarScreen />);
    twoFingers(screen.getByTestId('calendar-screen'), 100, 90);
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
  });

  // "It just shows a red column" — Dominik, 2026-10-30, on 28 October. The
  // day row says why, under the day's name; the column stays empty.
  it('a holiday says so under its day, not in the grid', () => {
    useAppStore.setState({
      mobileCalendarView: 'week',
      mobileSelectedDayIso: '2026-10-28',
    } as never);
    render(<CalendarScreen />);
    const strip = screen.getByTestId('day-strip');
    const chip = within(strip).getByRole('button', { name: /St 28/ });
    expect(within(chip).getByText('svátek')).toBeTruthy();
    expect(within(strip).getAllByText('svátek')).toHaveLength(1);
    expect(within(screen.getByTestId('week-grid')).queryByText(/svátek/i)).toBeNull();
  });
});
