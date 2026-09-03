import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The calendar has to say which week it is showing.
 *
 * The day strip changed five chips under a 28px `>` and nothing named what had
 * changed — "switching to the next week in the calendar has a small '>' button.
 * It feels a bit unintuitive". A control that does not report its effect cannot
 * teach the gesture that produces it, and once the strip also swipes, a
 * student who has swiped four times needs a way back.
 *
 * The label goes in the header's eyebrow, which has been empty since a "Ahoj,
 * {name}" greeting was taken out of it — so this costs no height, and Zkoušky
 * and Předměty already use that slot for exactly this kind of context.
 *
 * The teaching week NUMBER leads, because it is the unit MENDELU students use:
 * assignments are set "in week 9", IS publishes a table of them, and the
 * desktop header has shown it beside the calendar all along. Fifth time the
 * phone has had to catch up with something the extension already knew, after
 * the holidays, the enrolled subjects, the fail rates and the teaching period.
 */
const baseState = {
  language: 'cz',
  mobileSelectedDayIso: '2026-04-20', // a Monday
  mobileSheets: [],
  fullName: 'Jana Nováková',
  hiddenItems: [],
  firstSyncSettled: true,
  syncLoaded: { schedule: true },
  syncStatus: {
    isSyncing: false,
    lastSync: 1,
    error: null,
    handshakeDone: true,
    handshakeTimedOut: false,
  },
};

describe('CalendarScreen — the week label', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      ...baseState,
      schedule: { data: [], status: 'ready' },
      teachingWeekData: null,
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('names the dates of the week on screen', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('20.–24. 4.')).toBeInTheDocument();
  });

  it('leads with the teaching week when IS has told us one', () => {
    useAppStore.setState({
      teachingWeekData: { weeks: [{ week: 9, from: '2026-04-20', to: '2026-04-26' }], total: 13 },
    } as never);
    render(<CalendarScreen />);
    expect(screen.getByText('9. týden · 20.–24. 4.')).toBeInTheDocument();
  });

  /**
   * `getWeekForDate` returns null both outside the teaching period and while
   * IS's table is still in flight, and the two are indistinguishable here — so
   * the dates alone are the only honest output. Asserting a week number from a
   * late fetch would be the same class of confident wrong answer that
   * `isOutsideTeaching` was written to avoid.
   */
  it('says only the dates when there is no teaching week to report', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('20.–24. 4.')).toBeInTheDocument();
    expect(screen.queryByText(/týden ·/)).not.toBeInTheDocument();
  });

  it('is there while the schedule is still loading', () => {
    // The label is derived from the selected day, not from the fetch, so it is
    // knowable in every state — the same reason the date is in the header.
    useAppStore.setState({
      schedule: { data: [], status: 'loading' },
      syncLoaded: {},
      firstSyncSettled: false,
      syncStatus: { ...baseState.syncStatus, isSyncing: true },
    } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
    expect(screen.getByText('20.–24. 4.')).toBeInTheDocument();
  });

  it('follows the strip when the week changes', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Další týden' }));
    expect(screen.getByText('27. 4. – 1. 5.')).toBeInTheDocument();
  });
});

describe('CalendarScreen — getting back to today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      ...baseState,
      schedule: { data: [], status: 'ready' },
      teachingWeekData: null,
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('offers nothing while today is the day on screen', () => {
    // A control that is always there, next to the date it points at, is one
    // more thing to read and never anything to do.
    render(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: 'Dnes' })).not.toBeInTheDocument();
  });

  it('appears once the student has moved off today', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Další týden' }));
    expect(screen.getByRole('button', { name: 'Dnes' })).toBeInTheDocument();
  });

  it('comes straight back, however far away the week is', () => {
    render(<CalendarScreen />);
    const next = screen.getByRole('button', { name: 'Další týden' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText('11.–15. 5.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));
    expect(screen.getByText('20.–24. 4.')).toBeInTheDocument();
    expect(screen.getByText('Pondělí 20. dubna')).toBeInTheDocument();
    // And it takes itself away again.
    expect(screen.queryByRole('button', { name: 'Dnes' })).not.toBeInTheDocument();
  });
});
