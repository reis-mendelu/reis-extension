import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';
import type { CalendarCustomEvent } from '../../../../types/calendarTypes';

/**
 * The phone agenda used to build from `useSchedule()` alone, so a custom
 * calendar event — a hand-made entry, or the 90-minute block "Mám zájem"
 * writes for a society event — existed in the store, rendered in the desktop
 * WeeklyCalendar (via `useCalendarData`), and was invisible on the phone.
 * reIS is phone-first, so that is the surface where it mattered most.
 */
const rsvpBlock: CalendarCustomEvent = {
  // The id shape `planEventBlocks` mints — see services/eventCalendar/plan.ts.
  id: 'rsvp:evt-42',
  title: 'Přednáška o AI',
  date: '20260420',
  startTime: '17:00',
  endTime: '18:30',
  room: 'Q01',
};

describe('CalendarScreen — custom calendar events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      customEvents: [],
      hiddenItems: { events: [], courses: [] },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('renders a custom event on the day it falls on', () => {
    useAppStore.setState({
      schedule: { data: [lesson({})], status: 'success' } as never,
      customEvents: [rsvpBlock],
    });
    render(<CalendarScreen />);
    expect(within(screen.getByTestId('day-agenda')).getByText('Přednáška o AI')).toBeInTheDocument();
  });

  it('renders a custom event on a day that has no lessons at all', () => {
    // The empty state is the whole point: an evening society block is exactly
    // the thing a student has on an otherwise free day, and "Nic nemáš,
    // pohodička" over it is a wrong answer, not an empty one.
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      customEvents: [rsvpBlock],
    });
    render(<CalendarScreen />);
    expect(screen.queryByText('Nic nemáš, pohodička')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('day-agenda')).getByText('Přednáška o AI')).toBeInTheDocument();
  });

  it('places the custom event in start order among the day’s lessons', () => {
    useAppStore.setState({
      schedule: {
        data: [lesson({ id: 'late', startTime: '19:00', endTime: '20:50' })],
        status: 'success',
      } as never,
      customEvents: [rsvpBlock],
    });
    render(<CalendarScreen />);
    const rows = within(screen.getByTestId('day-agenda')).getAllByTestId('agenda-event');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Přednáška o AI');
  });

  it('leaves a custom event on another day out of the agenda', () => {
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      customEvents: [{ ...rsvpBlock, date: '20260421' }],
    });
    render(<CalendarScreen />);
    expect(screen.queryByText('Přednáška o AI')).not.toBeInTheDocument();
  });

  it('does not let a custom event open a subject drawer for a course that does not exist', () => {
    // A custom event carries no courseCode, so the row's subject tap would
    // push `{ kind: 'subjectDrawer', courseCode: '' }` — a drawer for nothing.
    // The row still shows the block; it just is not a door.
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      customEvents: [rsvpBlock],
    });
    render(<CalendarScreen />);
    const row = within(screen.getByTestId('day-agenda')).getByTestId('agenda-event');
    expect(within(row).queryByRole('button', { name: /Přednáška o AI/ })).not.toBeInTheDocument();
  });

  it('carries no map pin when the custom event names no room', () => {
    // `focusRoomByCode('')` focuses nothing: a pin that cannot work must not
    // be offered. With a room, it stays.
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      customEvents: [{ ...rsvpBlock, room: undefined }],
    });
    render(<CalendarScreen />);
    const row = within(screen.getByTestId('day-agenda')).getByTestId('agenda-event');
    expect(within(row).queryByLabelText('Ukázat na mapě')).not.toBeInTheDocument();
  });
});
