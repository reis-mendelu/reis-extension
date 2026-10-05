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

  it('the switch turns the day agenda into the week grid', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('day-body')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));

    expect(useAppStore.getState().mobileCalendarView).toBe('week');
    expect(screen.getByTestId('week-grid')).toBeTruthy();
    expect(screen.queryByTestId('day-body')).toBeNull();
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

  it('tapping a day in the strip opens that day', () => {
    useAppStore.setState({ mobileCalendarView: 'week' } as never);
    render(<CalendarScreen />);
    fireEvent.click(within(screen.getByTestId('day-strip')).getByRole('button', { name: /Út 6/ }));
    expect(useAppStore.getState().mobileCalendarView).toBe('day');
    expect(useAppStore.getState().mobileSelectedDayIso).toBe('2026-10-06');
  });

  it('the Now/Next card belongs to the day view', () => {
    vi.setSystemTime(new Date('2026-10-07T15:30:00'));
    useAppStore.setState({ mobileCalendarView: 'week', now: new Date() } as never);
    render(<CalendarScreen />);
    expect(screen.queryByTestId('now-next-card')).toBeNull();
  });
});
