import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { makeLesson as lesson } from '../../../../test/fixtures/lesson';

describe('CalendarScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      syncStatus: { isSyncing: false, lastSync: 1, error: null, handshakeDone: true, handshakeTimedOut: false },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the empty state when the day has no lessons', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('renders the now-running hero while a lesson is in progress', () => {
    useAppStore.setState({ schedule: { data: [lesson({})], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(within(screen.getByTestId('now-next-card')).getByText('Teď běží')).toBeInTheDocument();
    expect(within(screen.getByTestId('now-next-card')).getByText(/Management/)).toBeInTheDocument();
  });

  it('shows the running lesson in both the hero and the day agenda, not just the hero', () => {
    // The hero is a highlight, not a replacement — the agenda must render the
    // complete day exactly as buildDayAgenda returns it, including whatever
    // lesson is currently running. Regression guard for the dedup filter that
    // used to strip the running lesson out of the agenda list.
    useAppStore.setState({ schedule: { data: [lesson({})], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(within(screen.getByTestId('now-next-card')).getByText(/Management/)).toBeInTheDocument();
    expect(within(screen.getByTestId('day-agenda')).getByText(/Management/)).toBeInTheDocument();
  });

  it('renders a gap marker between distant lessons', () => {
    useAppStore.setState({
      schedule: {
        data: [lesson({ id: 'a' }), lesson({ id: 'b', startTime: '13:00', endTime: '14:50' })],
        status: 'success', weekStart: null,
      } as never,
    });
    render(<CalendarScreen />);
    expect(screen.getByTestId('agenda-gap')).toBeInTheDocument();
  });
});
