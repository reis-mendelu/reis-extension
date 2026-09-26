import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { syncService } from '../../../../services/sync';
import { PULL_REFRESH_THRESHOLD_PX } from '../../primitives/pullToRefresh';
import type { ExamSubject } from '../../../../types/exams';

/**
 * The calendar's manual refresh: a pull down on the day, and a screen-reader
 * button for whoever cannot pull.
 *
 * The schedule TTL is 24h, so a student who sees yesterday's timetable has no
 * way to ask for today's. Both routes call `refresh_schedule`, which fetches
 * the timetable and nothing else — ~3s against a real account, where the full
 * `trigger_sync` crawl it replaced took ~30s for data the calendar never shows.
 *
 * It was a visible circle on its own 24px row under the date (#370). That row
 * made the calendar header taller than every other tab's for a control used a
 * few times a term, so it became the gesture every phone list already has.
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
    // A phone: the pull is the visible refresh there. A Mac is `isTouch: false`.
    isTouch: true,
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
    scheduleRefreshing: false,
    ...overrides,
  } as never);
}

/** One finger from (x, y) travelling by (dx, dy), in a few frames, then lifted. */
function drag(el: HTMLElement, dx: number, dy: number, from = { x: 100, y: 100 }) {
  const at = (f: number) => [{ clientX: from.x + dx * f, clientY: from.y + dy * f }];
  fireEvent.touchStart(el, { touches: at(0) });
  for (const f of [0.25, 0.5, 0.75, 1]) fireEvent.touchMove(el, { touches: at(f) });
  fireEvent.touchEnd(el, { touches: [] });
}

const FAR = PULL_REFRESH_THRESHOLD_PX + 20;

describe('the calendar refresh', () => {
  let trigger: ReturnType<typeof vi.spyOn>;
  let full: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    baseState();
    trigger = vi.spyOn(syncService, 'triggerScheduleRefresh').mockResolvedValue(undefined);
    full = vi.spyOn(syncService, 'triggerSync').mockImplementation(() => undefined);
  });
  afterEach(() => {
    trigger.mockRestore();
    full.mockRestore();
    vi.useRealTimers();
  });

  it('pulling the day down past the threshold refreshes the schedule, once', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), 0, FAR);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  // The listeners sat on the day's scroller alone, so the top half of the
  // screen — date, Now/Next card, the week strip — was dead to a pull, and that
  // half is exactly where a finger reaching for "refresh" starts.
  it('pulling down on the date header refreshes', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('calendar-screen').firstElementChild as HTMLElement, 0, FAR);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('pulling down on the week strip refreshes', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-strip'), 0, FAR);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('a sideways swipe on the week strip changes the week and does not refresh', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-strip'), -FAR * 2, 10);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('a pull from the header still waits for the day to be at its top', () => {
    // The list is held down with the spinner in the gap while it refreshes;
    // doing that to a list scrolled halfway down would jump it.
    render(<CalendarScreen />);
    const body = screen.getByTestId('day-body');
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 120 });
    drag(screen.getByTestId('calendar-screen').firstElementChild as HTMLElement, 0, FAR);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('never runs the full sync — the calendar asks for the timetable only', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), 0, FAR);
    fireEvent.click(screen.getByLabelText(REFRESH));
    expect(full).not.toHaveBeenCalled();
  });

  it('spins while the schedule refresh runs, and stops when it answers', async () => {
    let done!: () => void;
    trigger.mockReturnValue(new Promise<void>((r) => (done = r)));
    render(<CalendarScreen />);
    const indicator = screen.getByTestId('pull-refresh-indicator');
    expect(indicator.dataset.state).toBeUndefined();
    drag(screen.getByTestId('day-body'), 0, FAR);
    expect(indicator.dataset.state).toBe('refreshing');
    await act(async () => {
      done();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(indicator.dataset.state).toBeUndefined();
  });

  it('does not spin for the scheduled background sync', () => {
    // The spinner answers the student's pull. A background run is not that.
    baseState({ syncStatus: { ...LOADED, isSyncing: true } });
    render(<CalendarScreen />);
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBeUndefined();
  });

  it('a short pull does nothing', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), 0, PULL_REFRESH_THRESHOLD_PX - 10);
    expect(trigger).not.toHaveBeenCalled();
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBeUndefined();
  });

  it('an upward drag does nothing — that is a scroll', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), 0, -FAR, { x: 100, y: 400 });
    expect(trigger).not.toHaveBeenCalled();
  });

  it('a sideways swipe changes the day and does not refresh', () => {
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), -FAR * 2, 10);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('does not arm when the day is scrolled away from the top', () => {
    // Otherwise a fling back up to the top that keeps going turns into a pull.
    render(<CalendarScreen />);
    const body = screen.getByTestId('day-body');
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 120 });
    drag(body, 0, FAR);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('a pull mid-refresh starts no second refresh', () => {
    baseState({ scheduleRefreshing: true });
    render(<CalendarScreen />);
    drag(screen.getByTestId('day-body'), 0, FAR);
    expect(trigger).not.toHaveBeenCalled();
  });

  it('two fingers are not a pull', () => {
    render(<CalendarScreen />);
    const body = screen.getByTestId('day-body');
    const two = (y: number) => [
      { clientX: 100, clientY: y },
      { clientX: 200, clientY: y },
    ];
    fireEvent.touchStart(body, { touches: two(100) });
    fireEvent.touchMove(body, { touches: two(100 + FAR) });
    fireEvent.touchEnd(body, { touches: [] });
    expect(trigger).not.toHaveBeenCalled();
  });

  it('the visible circle under the date is gone', () => {
    // The row it sat on made the calendar header one line taller than the
    // other tabs'. What is left is screen-reader-only, taking no layout.
    render(<CalendarScreen />);
    expect(screen.getByLabelText(REFRESH).className).toContain('sr-only');
  });

  it('shows itself to a keyboard user who tabs onto it', () => {
    // An iPad with a keyboard can focus it; an invisible focused control is a
    // dead end for a sighted keyboard user.
    render(<CalendarScreen />);
    const cls = screen.getByLabelText(REFRESH).className;
    expect(cls).toContain('focus-visible:not-sr-only');
    expect(cls).toMatch(/focus-visible:outline/);
  });

  it('keeps a screen-reader button, because a pull cannot be made by VoiceOver', () => {
    render(<CalendarScreen />);
    fireEvent.click(screen.getByLabelText(REFRESH));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('disables the screen-reader button while the refresh is running', () => {
    baseState({ scheduleRefreshing: true });
    render(<CalendarScreen />);
    expect(screen.getByLabelText(REFRESH)).toBeDisabled();
  });

  it('keeps the screen-reader button through the loading and error gates', () => {
    // Same rule the header actions follow: a control that vanishes during a
    // crawl is missing exactly when a student reaches for it.
    baseState({ syncLoaded: {}, syncStatus: { ...LOADED, isSyncing: true } });
    const loading = render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
    loading.unmount();

    baseState({ syncLoaded: {}, syncStatus: { ...LOADED, error: 'boom' } });
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-error')).toBeInTheDocument();
    expect(screen.getByLabelText(REFRESH)).toBeInTheDocument();
  });

  // The iPad app on a Mac reports `pointer: fine`, and neither a mouse drag nor
  // a two-finger trackpad scroll produces the touch events the pull listens
  // for. Without a visible button a Mac student could not refresh at all.
  it('on a Mac, is a visible action in the header row rather than a row of its own', () => {
    baseState({ isTouch: false });
    render(<CalendarScreen />);
    const button = screen.getByLabelText(REFRESH);
    expect(button.className).not.toContain('sr-only');
    const search = screen.getByLabelText('Hledat');
    // Same row as the header actions, so the header is no taller than any
    // other tab's.
    expect(button.closest('.justify-between')).toBe(search.closest('.justify-between'));
    fireEvent.click(button);
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('does not put the calendar refresh on the exams screen', () => {
    // Exams has its own pull, which refreshes exam terms only (pullHint.test).
    // This button's timetable refresh would be the wrong answer there.
    baseState({ exams: { data: [examWithTerm()], status: 'success', error: null } });
    render(<ExamsScreen />);
    expect(screen.getByTestId('exams-screen')).toBeInTheDocument();
    expect(screen.queryByLabelText(REFRESH)).not.toBeInTheDocument();
  });
});
