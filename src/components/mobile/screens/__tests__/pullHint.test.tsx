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
 * Teaching the pull: until a student has pulled once, the list nudges itself
 * down and back on each visit, with the spinner peeking out — a replay of what
 * a short real pull looks like, not a separate illustration.
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
    pullHintLearned: false,
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

  it('plays on exams too, including the empty state a September student sees', () => {
    render(<ExamsScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS));
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it('does not play once the student has pulled', () => {
    baseState({ pullHintLearned: true });
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('does not play while it is still unknown whether they have', () => {
    baseState({ pullHintLearned: null });
    render(<CalendarScreen />);
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
  });

  it('gives way to a finger that lands before it starts', () => {
    render(<CalendarScreen />);
    fireEvent.touchStart(screen.getByTestId('day-body'), {
      touches: [{ clientX: 1, clientY: 1 }],
    });
    act(() => vi.advanceTimersByTime(PULL_HINT_DELAY_MS * 3));
    expect(animate).not.toHaveBeenCalled();
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

  it('a real pull on either screen retires it, and is remembered', () => {
    render(<ExamsScreen />);
    pull(screen.getByTestId('exam-list'));
    expect(useAppStore.getState().pullHintLearned).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'pull_hint_learned', true);
  });
});

describe('the exams pull', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    baseState({ pullHintLearned: true });
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
    baseState({ pullHintLearned: true, examsRefreshing: true });
    render(<ExamsScreen />);
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBe('refreshing');
  });
});
