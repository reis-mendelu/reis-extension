import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { toast } from 'sonner';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

/**
 * Spec 2026-10-09: a student who never saved a view is asked once, on their
 * own timetable. Den | Týden swaps the calendar live; nothing is saved until
 * "Uložit"; leaving without saving asks again next time.
 */
describe('CalendarScreen — first-open view chooser', () => {
  const lesson = {
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
    id: 'pj',
    date: '20261007',
    startTime: '15:00',
    endTime: '16:50',
    courseName: 'Programovací jazyk Java',
    courseCode: 'EBC-PJ',
    room: 'Q07',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T10:00:00'));
    vi.mocked(toast).mockClear();
    useAppStore.setState({
      now: new Date('2026-10-07T10:00:00'),
      language: 'cz',
      mobileSelectedDayIso: '2026-10-07',
      mobileSheets: [],
      mobileTab: 'calendar',
      mobileCalendarView: 'day',
      savedCalendarView: 'day',
      calendarViewChosen: false,
      schedule: { data: [lesson], status: 'success' },
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

  const chooser = () => screen.queryByTestId('calendar-view-chooser');

  it('asks a student who never saved a view', () => {
    render(<CalendarScreen />);
    expect(chooser()).not.toBeNull();
    expect(screen.getByText('Jak chceš vidět rozvrh?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Uložit: Den' })).toBeTruthy();
  });

  it('does not ask before the choice has hydrated', () => {
    useAppStore.setState({ calendarViewChosen: null } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('does not ask once a view is saved', () => {
    useAppStore.setState({ calendarViewChosen: true } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('does not ask over the skeleton', () => {
    useAppStore.setState({
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: false,
        handshakeTimedOut: false,
      },
    } as never);
    render(<CalendarScreen />);
    expect(chooser()).toBeNull();
  });

  it('trying Týden swaps in the week grid and saves nothing', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(screen.getByTestId('week-grid')).toBeTruthy();
    expect(useAppStore.getState().savedCalendarView).toBe('day');
    expect(useAppStore.getState().calendarViewChosen).toBe(false);
    expect(screen.getByRole('button', { name: 'Uložit: Týden' })).toBeTruthy();
  });

  it('Uložit saves the view, closes the chooser and says where it lives now', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit: Týden' }));
    expect(useAppStore.getState().savedCalendarView).toBe('week');
    expect(useAppStore.getState().calendarViewChosen).toBe(true);
    expect(chooser()).toBeNull();
    expect(toast).toHaveBeenCalledWith('Uloženo. Změníš to v Profilu → Nastavení.');
  });
});
