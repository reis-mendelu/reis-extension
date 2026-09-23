import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { rsvpBlockId } from '../../../../utils/rsvpBlocks';

/**
 * Answering "Mám zájem" puts the event in the calendar — on the PHONE too.
 *
 * `rsvpBlockSync` has written the block into `customEvents` since the RSVP
 * shipped, and the desktop grid has rendered it since (`useCalendarData` merges
 * `customEvents` into its week). The phone never did: `CalendarScreen` builds
 * its day from `schedule.data` alone, so every custom event — a society event
 * the student signed up to, and equally one they typed in themselves — was
 * written, persisted, reconciled, and invisible.
 *
 * The existing RSVP tests all assert the block reaches the STORE, which is why
 * this shipped broken. These assert a screen shows it.
 */
describe('CalendarScreen — RSVP blocks on the phone', () => {
  const lesson = {
    id: 'l1',
    date: '20260420',
    startTime: '09:00',
    endTime: '10:50',
    courseName: 'Matematika',
    courseCode: 'MT',
    courseId: '',
    room: 'Q01',
    roomStructured: { name: 'Q01', id: '' },
    teachers: [],
    periodId: '',
    studyId: '',
    campus: '',
    isDefaultCampus: 'true',
    facultyCode: '',
    isSeminar: 'false',
    isConsultation: 'false',
  };

  const party = {
    id: rsvpBlockId('evt-1'),
    title: 'ESN Welcome Party',
    date: '20260420',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Klub Fléda',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      mobileSheets: [],
      mobileTab: 'calendar',
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

  it('shows an event the student answered on the day it falls', () => {
    useAppStore.setState({ customEvents: [party] } as never);
    render(<CalendarScreen />);

    expect(screen.getByText('ESN Welcome Party')).toBeTruthy();
  });

  it('shows one on a day that has no lessons at all', () => {
    // The realistic case, and the one the empty state got wrong: a society
    // event on a Saturday answered "Mám zájem" read as "Nic nemáš, pohodička".
    useAppStore.setState({
      mobileSelectedDayIso: '2026-04-25',
      customEvents: [{ ...party, date: '20260425' }],
    } as never);
    render(<CalendarScreen />);

    expect(screen.getByText('ESN Welcome Party')).toBeTruthy();
    expect(screen.queryByTestId('calendar-empty-day')).toBeNull();
  });

  it('takes the answer away again when the student withdraws it', () => {
    // Withdrawal is what `rsvpBlockSync` expresses by removing the block, so
    // the screen must be reading the live list rather than a copy of its own.
    const { rerender } = render(<CalendarScreen />);
    useAppStore.setState({ customEvents: [party] } as never);
    rerender(<CalendarScreen />);
    expect(screen.getByText('ESN Welcome Party')).toBeTruthy();

    useAppStore.setState({ customEvents: [] } as never);
    rerender(<CalendarScreen />);
    expect(screen.queryByText('ESN Welcome Party')).toBeNull();
  });

  it('marks the day in the strip, so the student can find it', () => {
    // Without the dot the block exists on a day that advertises nothing, and
    // the only way to it is to guess which chip to press.
    useAppStore.setState({
      mobileSelectedDayIso: '2026-04-20',
      schedule: { data: [], status: 'success' },
      customEvents: [{ ...party, date: '20260424' }],
    } as never);
    render(<CalendarScreen />);

    const friday = screen.getByRole('button', { name: /24/ });
    expect(friday.querySelector('[data-testid="day-chip-lessons"]')).toBeTruthy();
  });
});
