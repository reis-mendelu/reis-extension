import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';

// `firstSyncSettled` is latched, never cleared — so once one crawl has
// finished, a later retry that has still not delivered a domain used to fall
// straight through to ScreenError and sit there for the whole retry. The
// failure state is only honest about a sync that is over; while one is in
// flight with nothing cached, the skeleton is the truthful answer.
//
// The latch still does its own job: a student who genuinely has no exams gets
// `syncLoaded.exams`, so no later sync can put a skeleton back over their
// empty screen.
describe('a retry with the domain still unloaded', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: '2026-04-20',
      firstSyncSettled: true,
      syncLoaded: {},
      schedule: { data: [], status: 'success' } as never,
      exams: { data: [], status: 'success', error: null },
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: {},
      syncStatus: {
        isSyncing: true,
        lastSync: 1,
        error: 'boom',
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it('shows the calendar skeleton rather than the error', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-error')).not.toBeInTheDocument();
  });

  it('shows the exams skeleton rather than the error', () => {
    render(<ExamsScreen />);
    expect(screen.getByTestId('exams-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('exams-error')).not.toBeInTheDocument();
  });

  it('leaves a settled, failed sync on the error screen', () => {
    // The retry finishing without the domain is still a failure.
    useAppStore.setState({
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: 'boom',
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    });
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-error')).toBeInTheDocument();
  });

  it('does not put a skeleton back over a genuinely empty week', () => {
    useAppStore.setState({ syncLoaded: { schedule: true } });
    render(<CalendarScreen />);
    expect(screen.queryByTestId('calendar-skeleton')).not.toBeInTheDocument();
    expect(screen.getByText('Nic nemáš, pohodička')).toBeInTheDocument();
  });
});
