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
    useAppStore.setState({ schedule: { data: [], status: 'success' } as never });
    render(<CalendarScreen />);
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });

  it('renders the now-running hero while a lesson is in progress', () => {
    useAppStore.setState({
      schedule: { data: [lesson({})], status: 'success' } as never,
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
      schedule: { data: [lesson({})], status: 'success' } as never,
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
      } as never,
    });
    render(<CalendarScreen />);
    expect(screen.getByTestId('agenda-gap')).toBeInTheDocument();
  });

  // The greeting was dropped as redundant — it told the student their own name.
  // The date, previously the small eyebrow above it, is the title now.
  it('shows no greeting, and a User icon avatar when fullName is absent', () => {
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      fullName: null,
    });
    render(<CalendarScreen />);
    expect(screen.queryByText(/^Ahoj/)).not.toBeInTheDocument();
    // Asserted, not merely absent: "no greeting" also passes on a blank title.
    // The selected day is 2026-04-20 and the header is capitalised.
    expect(screen.getByText('Pondělí 20. dubna')).toBeInTheDocument();
    expect(screen.getByLabelText('Profil').querySelector('svg')).toBeInTheDocument();
  });

  it('still derives avatar initials from fullName', () => {
    useAppStore.setState({
      schedule: { data: [], status: 'success' } as never,
      fullName: 'Jana Nováková',
    });
    render(<CalendarScreen />);
    expect(screen.queryByText(/^Ahoj/)).not.toBeInTheDocument();
    expect(screen.getByText('Pondělí 20. dubna')).toBeInTheDocument();
    expect(screen.getByLabelText('Profil')).toHaveTextContent('JN');
  });

  it('gives the avatar and bulletin buttons accessible names', () => {
    useAppStore.setState({ schedule: { data: [], status: 'success' } as never });
    render(<CalendarScreen />);
    expect(screen.getByLabelText('Profil')).toBeInTheDocument();
    expect(screen.getByLabelText('Rozbalit vývěsku')).toBeInTheDocument();
  });

  it('offers the selected day’s own week', () => {
    // The row used to be anchored on a stored `schedule.weekStart`, which
    // `syncSchedule` wrote as the SEMESTER start (Feb 1 / Sep 1) despite the
    // name — so a student in April was offered five days in February and could
    // not reach the current week at all. The field is gone; the week comes
    // from the selected day, so the row and the header cannot disagree.
    useAppStore.setState({ schedule: { data: [], status: 'success' } as never });
    render(<CalendarScreen />);

    // Selected day is Monday 2026-04-20 → the row is 20–24 April.
    expect(screen.getByRole('button', { name: /20/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /24/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Ne 1$/ })).not.toBeInTheDocument();
  });

  it('omits an event hidden via hiddenItems.events from the day agenda', () => {
    useAppStore.setState({
      schedule: { data: [lesson({ id: 'l1' })], status: 'success' } as never,
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
