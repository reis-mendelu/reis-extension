import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { syncService } from '../../../../services/sync';
import { IndexedDBService } from '../../../../services/storage/IndexedDBService';
import { PULL_REFRESH_THRESHOLD_PX } from '../../primitives/pullToRefresh';
import { PULL_HINT_DELAY_MS } from '../../primitives/pullHint';

/**
 * Teaching the pull, and showing a refresh happen.
 *
 * Calendar: ONCE, ever, the list nudges itself down and back with the spinner
 * peeking out — a replay of a short real pull.
 *
 * Exams: every switch to the tab refreshes the exam terms, and the refresh is
 * the lesson — while it runs the list is held down with the spinner turning in
 * the gap, and it springs back when the answer arrives. The same hold plays on
 * the calendar after a pull.
 */

const LOADED = {
  isSyncing: false,
  lastSync: 1,
  error: null,
  handshakeDone: true,
  handshakeTimedOut: false,
};

function baseState(overrides: Record<string, unknown> = {}) {
  useAppStore.setState({
    language: 'cz',
    mobileSelectedDayIso: '2026-04-20',
    mobileSheets: [],
    firstSyncSettled: true,
    syncLoaded: { schedule: true, exams: true },
    schedule: { data: [], status: 'success' },
    exams: { data: [], status: 'success', error: null },
    syncStatus: LOADED,
    scheduleRefreshing: false,
    examsRefreshing: false,
    pullHintSeen: false,
    ...overrides,
  } as never);
}

function pull(el: HTMLElement) {
  const at = (dy: number) => [{ clientX: 100, clientY: 100 + dy }];
  fireEvent.touchStart(el, { touches: at(0) });
  for (const f of [0.25, 0.5, 0.75, 1])
    fireEvent.touchMove(el, { touches: at((PULL_REFRESH_THRESHOLD_PX + 20) * f) });
  fireEvent.touchEnd(el, { touches: [] });
}

describe('the pull hint', () => {
  let animate: ReturnType<typeof vi.fn>;
  const spies: { mockRestore: () => void }[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    baseState();
    animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }));
    // happy-dom has no Web Animations API.
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    spies.push(vi.spyOn(syncService, 'triggerScheduleRefresh').mockResolvedValue(undefined));
    spies.push(vi.spyOn(syncService, 'triggerExamRefresh').mockResolvedValue(undefined));
    spies.push(vi.spyOn(IndexedDBService, 'set').mockResolvedValue(undefined as never));
  });
  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore());
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    vi.useRealTimers();
  });

  it('plays on the calendar after the screen settles, not at once', () => {
    render(<CalendarScreen />);
    expect(animate).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS));
    // The list and the spinner move together.
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('plays once ever on the calendar — seen once it has played', async () => {
    const first = render(<CalendarScreen />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PULL_HINT_DELAY_MS);
    });
    expect(useAppStore.getState().pullHintSeen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'pull_hint_seen', true);
    first.unmount();
    animate.mockClear();
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('is not marked seen until it has played to the end, so it is never cut short', async () => {
    // Marking it seen turns the hint off, and that cleanup cancels whatever is
    // running — so it must only happen once the animation has finished.
    const cancel = vi.fn();
    animate.mockReturnValue({ cancel, finished: new Promise(() => {}) });
    render(<CalendarScreen />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PULL_HINT_DELAY_MS);
    });
    expect(animate).toHaveBeenCalledTimes(2);
    expect(useAppStore.getState().pullHintSeen).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('is not the exams lesson — exams show a real refresh instead', () => {
    render(<ExamsScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not play once it has been seen', () => {
    baseState({ pullHintSeen: true });
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not play while it is still unknown whether they have', () => {
    baseState({ pullHintSeen: null });
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('gives way to a finger that lands before it starts, and tries again next visit', () => {
    render(<CalendarScreen />);
    fireEvent.touchStart(screen.getByTestId('day-body'), {
      touches: [{ clientX: 1, clientY: 1 }],
    });
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
    expect(useAppStore.getState().pullHintSeen).toBe(false);
  });

  it('respects reduced motion', () => {
    const mm = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
    mm.mockRestore();
  });

  it('a real pull retires it too, and is remembered', () => {
    render(<CalendarScreen />);
    pull(screen.getByTestId('day-body'));
    expect(useAppStore.getState().pullHintSeen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'pull_hint_seen', true);
  });
});

describe('the refresh hold', () => {
  let animate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    baseState({ pullHintSeen: true });
    animate = vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve() }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
  });
  afterEach(() => {
    delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
    vi.useRealTimers();
  });

  const lastTransform = () => {
    const frames = animate.mock.calls.at(-1)?.[0] as Keyframe[];
    return frames.at(-1)?.transform;
  };

  it('holds the exams list down while the refresh runs, and springs back after', () => {
    baseState({ pullHintSeen: true, examsRefreshing: true });
    render(<ExamsScreen />);
    expect(lastTransform()).toBe('translateY(44px)');
    act(() => useAppStore.setState({ examsRefreshing: false } as never));
    expect(lastTransform()).toBe('translateY(0)');
  });

  it('holds the calendar the same way after a pull', () => {
    render(<CalendarScreen />);
    act(() => useAppStore.setState({ scheduleRefreshing: true } as never));
    expect(lastTransform()).toBe('translateY(44px)');
  });

  it('moves nothing under reduced motion, but still spins', () => {
    const mm = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    baseState({ pullHintSeen: true, examsRefreshing: true });
    render(<ExamsScreen />);
    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBe('refreshing');
    mm.mockRestore();
  });
});

describe('switching to exams', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    baseState({ mobileTab: 'calendar', demoMode: false });
    spies.push(vi.spyOn(syncService, 'triggerExamRefresh').mockResolvedValue(undefined));
  });
  afterEach(() => spies.splice(0).forEach((s) => s.mockRestore()));

  it('refreshes the exam terms every time', () => {
    useAppStore.getState().setMobileTab('exams');
    expect(syncService.triggerExamRefresh).toHaveBeenCalledTimes(1);
    useAppStore.setState({ examsRefreshing: false } as never);
    useAppStore.getState().setMobileTab('calendar');
    useAppStore.getState().setMobileTab('exams');
    expect(syncService.triggerExamRefresh).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on other tabs', () => {
    useAppStore.getState().setMobileTab('map');
    expect(syncService.triggerExamRefresh).not.toHaveBeenCalled();
  });

  it('does not refresh in demo mode, where it could only answer "not available"', () => {
    useAppStore.setState({ demoMode: true } as never);
    useAppStore.getState().setMobileTab('exams');
    expect(syncService.triggerExamRefresh).not.toHaveBeenCalled();
  });
});

describe('the exams pull', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    baseState({ pullHintSeen: true });
  });
  afterEach(() => {
    spies.splice(0).forEach((s) => s.mockRestore());
    vi.useRealTimers();
  });

  it('refreshes exams, and neither the timetable nor everything', () => {
    const exams = vi.spyOn(syncService, 'triggerExamRefresh').mockResolvedValue(undefined);
    const sched = vi.spyOn(syncService, 'triggerScheduleRefresh').mockResolvedValue(undefined);
    const full = vi.spyOn(syncService, 'triggerSync').mockImplementation(() => undefined);
    spies.push(exams, sched, full);
    render(<ExamsScreen />);
    pull(screen.getByTestId('exam-list'));
    expect(exams).toHaveBeenCalledTimes(1);
    expect(sched).not.toHaveBeenCalled();
    expect(full).not.toHaveBeenCalled();
  });

  it('has no visible refresh row any more, only the screen-reader button', () => {
    spies.push(vi.spyOn(syncService, 'triggerExamRefresh').mockResolvedValue(undefined));
    render(<ExamsScreen />);
    const button = screen.getByLabelText('Obnovit zkoušky');
    expect(button.className).toContain('sr-only');
    expect(screen.queryByText(/Aktualizováno/)).not.toBeInTheDocument();
  });

  it('spins for the exams refresh', () => {
    baseState({ pullHintSeen: true, examsRefreshing: true });
    render(<ExamsScreen />);
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBe('refreshing');
  });
});
