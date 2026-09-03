import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The header outlives the schedule fetch.
 *
 * Settings, notifications and the vývěska all hang off the calendar header's
 * three buttons, and the screen used to `return <CalendarSkeleton />` BEFORE
 * rendering that header — so for the whole of a first sync (minutes, on a real
 * crawl) there was no way to reach any of them. Reported as "it should be
 * possible to open a profile even when calendar is still loading"; the same
 * hole swallowed the other two buttons, and `ScreenError` had it too, which is
 * worse — a student who cannot reach settings cannot sign out and retry.
 *
 * The date is in the header rather than the body for the same reason: it is
 * derived from the selected day, not from the fetch, so it is knowable before
 * any lesson arrives.
 */
describe('CalendarScreen header', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      mobileSheets: [],
      fullName: 'Jana Nováková',
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

  it('keeps every header action reachable while the schedule is loading', () => {
    render(<CalendarScreen />);
    // Still loading — the skeleton is the point, not a side effect.
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat')).toBeInTheDocument();
    expect(screen.getByLabelText('Oznámení')).toBeInTheDocument();
    expect(screen.getByLabelText('Rozbalit vývěsku')).toBeInTheDocument();
  });

  it('shows the selected day in the header while the schedule is loading', () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Pondělí 20. dubna')).toBeInTheDocument();
  });

  it('opens search from the loading screen', () => {
    // Settings is a bottom-nav tab now, so the header's own destinations are
    // the vývěska, search and notifications.
    render(<CalendarScreen />);
    fireEvent.click(screen.getByLabelText('Hledat'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'search' }]);
  });

  it('opens the notifications sheet from the loading screen', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByLabelText('Oznámení'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'notifications' }]);
  });

  it('keeps the header actions reachable on the error screen', () => {
    // A settled sync that never delivered the schedule: this is the state a
    // student is stuck in on a bad connection, and the retry button is not the
    // only thing they might reasonably want to reach.
    useAppStore.setState({
      firstSyncSettled: true,
      syncLoaded: {},
      schedule: { data: [], status: 'success' } as never,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: 'boom',
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-error')).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat')).toBeInTheDocument();
    expect(screen.getByLabelText('Oznámení')).toBeInTheDocument();
    expect(screen.getByLabelText('Rozbalit vývěsku')).toBeInTheDocument();
  });

  it('keeps the header actions reachable before the handshake lands', () => {
    // The very first frames of a cold start, before the content script has
    // said anything at all.
    useAppStore.setState({
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: null,
        handshakeDone: false,
        handshakeTimedOut: false,
      },
    } as never);
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat')).toBeInTheDocument();
  });

  /**
   * The header brings its own `--safe-top` inset, so the skeleton underneath it
   * must not add a second one — that is what put the spinner a status bar's
   * height below where it belongs.
   */
  it('does not stack a second safe-area inset under the header', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-skeleton').className).not.toContain('--safe-top');
  });
});
