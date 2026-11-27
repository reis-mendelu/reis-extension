import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useRefreshAtExamOpening } from '../useRefreshAtExamOpening';
import type { ExamSubject } from '../../../types/exams';

// IS's "01.12.2026 08:00" is Prague time (CET, UTC+1): an absolute instant, whatever the
// zone of the test machine or the student's phone.
const START = new Date(Date.UTC(2026, 11, 1, 7, 0, 0));

const exams = (registrationStart: string): { data: ExamSubject[] } => ({
  data: [
    {
      version: 1,
      id: 's',
      name: 'Ekonometrie',
      code: 'EBC-EKO',
      sections: [
        {
          id: 'sec',
          name: 'zkouška',
          type: 'exam',
          status: 'open',
          terms: [
            {
              id: 't1',
              date: '15.12.2026',
              time: '09:00',
              registrationStart,
              canRegisterNow: false,
            },
          ],
        },
      ],
    },
  ],
});

function arrange(registrationStart: string, nowMs: number) {
  vi.setSystemTime(nowMs);
  const trigger = vi.fn();
  useAppStore.setState({
    exams: { ...exams(registrationStart), status: 'success', error: null },
    now: new Date(nowMs),
    demoMode: false,
    triggerExamsRefresh: trigger,
  } as never);
  return trigger;
}

describe('useRefreshAtExamOpening', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('asks IS again just after the registration opens — never earlier, never by itself unlocking', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 30_000);
    renderHook(() => useRefreshAtExamOpening(true));
    act(() => vi.advanceTimersByTime(30_000));
    expect(trigger).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_500));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('retries a few times in the first minute when IS lags behind the clock, then stops', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 1_000);
    renderHook(() => useRefreshAtExamOpening(true));
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(trigger.mock.calls.length).toBeGreaterThan(1);
    expect(trigger.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('does nothing for an opening weeks away — setTimeout would fire at once on that delay', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 40 * 24 * 3600_000);
    renderHook(() => useRefreshAtExamOpening(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(trigger).not.toHaveBeenCalled();
  });

  it('arms a far-off opening once it comes within range, for a view left open for days', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 40 * 24 * 3600_000);
    renderHook(() => useRefreshAtExamOpening(true));
    // A day at a time, each its own act: the wake-up re-runs the effect between them.
    for (let day = 0; day < 40; day++) act(() => vi.advanceTimersByTime(24 * 3600_000));
    act(() => vi.advanceTimersByTime(1_500));
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the screen is not in front, or in demo', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 1_000);
    renderHook(() => useRefreshAtExamOpening(false));
    useAppStore.setState({ demoMode: true } as never);
    renderHook(() => useRefreshAtExamOpening(true));
    act(() => vi.advanceTimersByTime(60_000));
    expect(trigger).not.toHaveBeenCalled();
  });

  it('is cancelled when the screen goes away', () => {
    const trigger = arrange('01.12.2026 08:00', START.getTime() - 1_000);
    const { unmount } = renderHook(() => useRefreshAtExamOpening(true));
    unmount();
    act(() => vi.advanceTimersByTime(60_000));
    expect(trigger).not.toHaveBeenCalled();
  });
});
