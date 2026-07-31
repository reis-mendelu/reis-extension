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

  it('shows the empty state when the day has no lessons', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('renders the now-running hero while a lesson is in progress', () => {
    useAppStore.setState({
      schedule: { data: [lesson({})], status: 'success', weekStart: null } as never,
    });
    render(<CalendarScreen />);
    expect(within(screen.getByTestId('now-next-card')).getByText('Teď běží')).toBeInTheDocument();
    expect(within(screen.getByTestId('now-next-card')).getByText(/Management/)).toBeInTheDocument();
  });

  it('shows the running lesson in both the hero and the day agenda, not just the hero', () => {
    // The hero is a highlight, not a replacement — the agenda must render the
    // complete day exactly as buildDayAgenda returns it, including whatever
    // lesson is currently running. Regression guard for the dedup filter that
    // used to strip the running lesson out of the agenda list.
    useAppStore.setState({
      schedule: { data: [lesson({})], status: 'success', weekStart: null } as never,
    });
    render(<CalendarScreen />);
    expect(within(screen.getByTestId('now-next-card')).getByText(/Management/)).toBeInTheDocument();
    expect(within(screen.getByTestId('day-agenda')).getByText(/Management/)).toBeInTheDocument();
  });

  it('renders a gap marker between distant lessons', () => {
    useAppStore.setState({
      schedule: {
        data: [lesson({ id: 'a' }), lesson({ id: 'b', startTime: '13:00', endTime: '14:50' })],
        status: 'success',
        weekStart: null,
      } as never,
    });
    render(<CalendarScreen />);
    expect(screen.getByTestId('agenda-gap')).toBeInTheDocument();
  });

  it('falls back to a name-less greeting and a User icon avatar when fullName is absent', () => {
    useAppStore.setState({
      schedule: { data: [], status: 'success', weekStart: null } as never,
      fullName: null,
    });
    render(<CalendarScreen />);
    expect(screen.getByText('Ahoj')).toBeInTheDocument();
    expect(screen.queryByText(/Ahoj,/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Profil').querySelector('svg')).toBeInTheDocument();
  });

  it('renders the named greeting and initials when fullName is present', () => {
    useAppStore.setState({
      schedule: { data: [], status: 'success', weekStart: null } as never,
      fullName: 'Jana Nováková',
    });
    render(<CalendarScreen />);
    expect(screen.getByText('Ahoj, Jana')).toBeInTheDocument();
    expect(screen.getByLabelText('Profil')).toHaveTextContent('JN');
  });

  it('gives the avatar and bulletin buttons accessible names', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success', weekStart: null } as never });
    render(<CalendarScreen />);
    expect(screen.getByLabelText('Profil')).toBeInTheDocument();
    expect(screen.getByLabelText('Rozbalit vývěsku')).toBeInTheDocument();
  });

  it('omits an event hidden via hiddenItems.events from the day agenda', () => {
    useAppStore.setState({
      schedule: { data: [lesson({ id: 'l1' })], status: 'success', weekStart: null } as never,
      hiddenItems: {
        events: [{ id: 'l1', courseCode: 'EBC-MAN', courseName: 'Management', date: '20260420' }],
        courses: [],
      },
    });
    render(<CalendarScreen />);
    expect(screen.queryByTestId('day-agenda')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });
});
