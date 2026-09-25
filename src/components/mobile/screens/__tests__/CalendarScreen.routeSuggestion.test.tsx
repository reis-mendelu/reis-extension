import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';

// Campus navigation is parked in the shipped build. These cases describe the
// feature as it will be when it comes back, so they switch it on; the last one
// pins what the parked build does.
const nav = vi.hoisted(() => ({ on: true }));
vi.mock('../../../../utils/routing/navigationEnabled', () => ({
  get CAMPUS_NAVIGATION_ENABLED() {
    return nav.on;
  },
}));

/**
 * The pin beside a lecture, and the "Trasa →" button on the hero, both cross
 * over to the map. Until now both landed there with the camera on the right
 * room and nothing that would walk the student to it — the map's own button
 * asks the timetable "what is next today?", which is a different question from
 * the one the student asked by tapping a specific row.
 */
describe('CalendarScreen → map route suggestion', () => {
  beforeEach(() => {
    nav.on = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.getState().clearRoute();
    useAppStore.setState({
      language: 'cz',
      // The screen reads the store's clock, the one the pulse advances.
      now: new Date('2026-04-20T10:00:00'),
      mobileSelectedDayIso: '2026-04-20',
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

  it('offers the tapped lecture as the walk, not whatever is next today', () => {
    useAppStore.setState({
      schedule: {
        data: [
          // Running now in Q01, so the map's own fallback would say "Q"…
          lesson({ id: 'now', room: 'Q01' }),
          // …while the row the student actually points at is in B.
          lesson({ id: 'later', room: 'B11', startTime: '15:00', endTime: '16:50' }),
        ],
        status: 'success',
      } as never,
    });
    render(<CalendarScreen />);

    const rows = within(screen.getByTestId('day-agenda')).getAllByLabelText('Ukázat na mapě');
    fireEvent.click(rows[1]!);

    expect(useAppStore.getState().routeSuggestion).toEqual({
      buildingName: 'B',
      roomLabel: 'B11',
    });
    expect(useAppStore.getState().mobileTab).toBe('map');
  });

  it('suggests the RUNNING lesson when the hero hands over to the map', () => {
    useAppStore.setState({
      schedule: {
        data: [
          lesson({ id: 'now', room: 'Q01' }),
          lesson({ id: 'next', room: 'B11', startTime: '11:00', endTime: '12:50' }),
        ],
        status: 'success',
      } as never,
    });
    render(<CalendarScreen />);

    fireEvent.click(screen.getByText('Trasa →'));

    // The hero is about the lesson on now, and a student who opens it mid-lesson
    // is the one who is late for it. Walking them to the lesson after — a room
    // they have hours to find — answered a question nobody asked.
    expect(useAppStore.getState().routeSuggestion?.roomLabel).toBe('Q01');
  });

  it("focuses the running lesson's room while navigation is parked", () => {
    nav.on = false;
    useAppStore.setState({
      routeSuggestion: null,
      mapSelection: null,
      schedule: {
        data: [
          lesson({ id: 'now', room: 'Q01' }),
          lesson({ id: 'next', room: 'B11', startTime: '11:00', endTime: '12:50' }),
        ],
        status: 'success',
      } as never,
    });
    render(<CalendarScreen />);

    fireEvent.click(screen.getByText('Trasa →'));

    const sel = useAppStore.getState().mapSelection;
    expect(useAppStore.getState().mobileTab).toBe('map');
    expect(sel?.kind === 'roomRef' && sel.entry.name).toBe('Q01');
  });

  it('offers nothing while navigation is parked — the pin only focuses the room', () => {
    nav.on = false;
    useAppStore.setState({
      // clearRoute keeps the suggestion on purpose, so start from none.
      routeSuggestion: null,
      schedule: { data: [lesson({ id: 'later', room: 'B11' })], status: 'success' } as never,
    });
    render(<CalendarScreen />);

    const rows = within(screen.getByTestId('day-agenda')).getAllByLabelText('Ukázat na mapě');
    fireEvent.click(rows[0]!);

    expect(useAppStore.getState().mobileTab).toBe('map');
    expect(useAppStore.getState().routeSuggestion).toBeNull();
  });
});
