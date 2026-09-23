import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { syncService } from '../../../../services/sync';
import { baseState, pull } from './pullTestSetup';

/**
 * Showing a refresh happen. Every switch to Exams refreshes the exam terms, and
 * while any refresh runs the list is held down with the spinner turning in the
 * gap, springing back when it answers. The calendar's pull gets the same hold.
 */

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
