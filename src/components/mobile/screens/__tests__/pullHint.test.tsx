import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { syncService } from '../../../../services/sync';
import { IndexedDBService } from '../../../../services/storage/IndexedDBService';
import { PULL_HINT_DELAY_MS } from '../../primitives/pullHint';
import { baseState, pull } from './pullTestSetup';

/**
 * The calendar's pull hint: ONCE, ever, the list nudges itself down and back
 * with the spinner peeking out — a replay of a short real pull. Exams have no
 * hint; they refresh on every visit instead (refreshHold.test).
 */

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

  it('an exams pull does not use up the calendar hint', () => {
    // Exams have no hint of their own; pulling there first must not stop the
    // calendar from ever teaching the gesture.
    render(<ExamsScreen />);
    pull(screen.getByTestId('exam-list'));
    expect(useAppStore.getState().pullHintSeen).toBe(false);
  });

  it('a real pull retires it too, and is remembered', () => {
    render(<CalendarScreen />);
    pull(screen.getByTestId('day-body'));
    expect(useAppStore.getState().pullHintSeen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'pull_hint_seen', true);
  });
});
