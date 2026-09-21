import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { syncService } from '../../../../services/sync';
import type { ExamSubject } from '../../../../types/exams';

/**
 * The manual refresh circle on the two screens whose data goes stale between
 * automatic runs.
 *
 * The schedule TTL is 24h, so a student who sees yesterday's timetable has no
 * way to ask for today's — `trigger_sync` is the `user` reason, which clears
 * every freshness stamp and bypasses the schedule TTL entirely. Desktop has
 * had this button since ExamsFreshness shipped; the phone had nothing.
 *
 * Deliberately NOT mocked with `vi.mock('.../services/sync')`: that module also
 * exports the seven `syncX` functions the screens' import graph pulls in, and
 * mocking the barrel would leave every one of them `undefined`.
 */
const REFRESH = 'Obnovit';

const LOADED = {
  isSyncing: false,
  lastSync: 1,
  error: null,
  handshakeDone: true,
  handshakeTimedOut: false,
};
const SYNCING = { ...LOADED, isSyncing: true };

function examWithTerm(): ExamSubject {
  return {
    version: 1,
    id: 'sub-1',
    name: 'Algoritmizace',
    code: 'EBC-ALG',
    sections: [
      {
        id: 'sec-1',
        name: 'zkouška',
        type: 'exam',
        status: 'registered',
        registeredTerm: { date: '1.6.2026', time: '09:00' },
        terms: [{ id: 'term-1', date: '1.6.2026', time: '09:00', canRegisterNow: true }],
      },
    ],
  } as ExamSubject;
}

function baseState(overrides: Record<string, unknown> = {}) {
  useAppStore.setState({
    language: 'cz',
    mobileSelectedDayIso: '2026-04-20',
    mobileSheets: [],
    firstSyncSettled: true,
    syncLoaded: { schedule: true, exams: true },
    schedule: { data: [], status: 'success' },
    exams: { data: [], status: 'success', error: null },
    examClassmates: {},
    examClassmatesLoading: {},
    examClassmatesError: {},
    lastExamClassmatesFetchedAt: {},
    syncStatus: LOADED,
    ...overrides,
  } as never);
}

describe('the manual refresh circle', () => {
  let trigger: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    baseState();
    trigger = vi.spyOn(syncService, 'triggerSync').mockImplementation(() => undefined);
  });
  afterEach(() => {
    trigger.mockRestore();
    vi.useRealTimers();
  });

  it('renders on the calendar screen', () => {
    render(<CalendarScreen />);
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });

  it('keeps a 44px tap target, however small the glyph looks', () => {
    // Measured on the running app at 320px: the glyph is 12px but the button
    // is 44x44 and the row it sits in is still 24px tall, because `-my-2.5`
    // hands the extra height back. A `btn-xs` circle measures 24x24, which
    // would be the smallest target in the app — DayChips grew its arrows to
    // h-11 for this exact reason and the header actions are h-10.
    //
    // Asserted as a class contract rather than a measurement: the test DOM
    // does not lay out, so geometry cannot be read here. The live numbers are
    // in the PR description.
    render(<CalendarScreen />);
    const cls = screen.getByLabelText(REFRESH).className;
    expect(cls).toContain('h-11');
    expect(cls).toContain('w-11');
    expect(cls).not.toContain('btn-xs');
  });

  it('renders on the exams screen', () => {
    render(<ExamsScreen />);
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });

  it('still renders on the exams screen when nothing is registered', () => {
    // The registered pill is `undefined` at zero, and the circle shares its
    // row — so an unconditional row is the only thing keeping the control on
    // screen for the student most likely to be waiting on a fetch.
    baseState({ exams: { data: [], status: 'success', error: null } });
    render(<ExamsScreen />);
    expect(screen.queryByText(/přihlášen/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });

  it('keeps the registered pill beside it', () => {
    baseState({ exams: { data: [examWithTerm()], status: 'success', error: null } });
    render(<ExamsScreen />);
    expect(screen.getByText('1 přihlášený')).toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });

  it('triggers a sync from the calendar screen', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByLabelText(REFRESH));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('triggers a sync from the exams screen', () => {
    render(<ExamsScreen />);
    fireEvent.click(screen.getByLabelText(REFRESH));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('spins and disables itself while a sync is running', () => {
    baseState({ syncStatus: SYNCING });
    render(<CalendarScreen />);
    const button = screen.getByLabelText(REFRESH);
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
  });

  it('does not spin when no sync is running', () => {
    render(<ExamsScreen />);
    const button = screen.getByLabelText(REFRESH);
    expect(button).not.toBeDisabled();
    expect(button.querySelector('svg')?.getAttribute('class') ?? '').not.toContain('animate-spin');
  });

  it('fires nothing when clicked mid-sync', () => {
    baseState({ syncStatus: SYNCING });
    render(<ExamsScreen />);
    fireEvent.click(screen.getByLabelText(REFRESH));
    expect(trigger).not.toHaveBeenCalled();
  });

  it('survives both screens loading and error gates', () => {
    // Same rule the header actions already follow: a control that vanishes
    // during a crawl is missing exactly when a student reaches for it.
    baseState({ syncLoaded: {}, syncStatus: { ...LOADED, isSyncing: true } });
    const loading = render(<ExamsScreen />);
    expect(screen.getByTestId('exams-skeleton')).toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
    loading.unmount();

    baseState({ syncLoaded: {}, syncStatus: { ...LOADED, error: 'boom' } });
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-error')).toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });
});
