import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * A way back to today. The week arrows and the day chips move you AWAY from
 * today one step at a time; something has to bring you back.
 *
 * It used to be a floating "Dnes" pill above the tab bar. Once the day/week
 * switch joined it there, "Dnes · Den · Týden" read as three similar words in a
 * row (Dominik, 2026-10-03: "we are just adding too many buttons"). The date in
 * the header IS the place in time, so it became the control: away from today
 * it carries a return glyph and tapping it goes back. The header stays one
 * line — the glyph sits beside the date, no row is added.
 */
describe('CalendarScreen — back to today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: null,
      mobileSheets: [],
      mobileCalendarView: 'day',
      schedule: { data: [], status: 'loading' } as never,
      firstSyncSettled: false,
      syncLoaded: {},
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('the date is plain text while today is shown', () => {
    render(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: /Zpět na dnešek/ })).toBeNull();
  });

  it('on any other day the date goes back to today', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-28' } as never);
    render(<CalendarScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Zpět na dnešek/ }));

    // null is "today" in the store, so the day re-derives itself at midnight.
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
  });

  it('the floating Dnes pill is gone', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-28' } as never);
    render(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: 'Dnes' })).toBeNull();
  });
});
