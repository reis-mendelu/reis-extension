import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScreenSignal } from '../useScreenSignal';
import { trackFeatureSignal } from '../../api/featureUsage';

vi.mock('../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));

/**
 * A screen counts when it is SHOWN, not per tap: the hook only hands the label
 * to `trackFeatureSignal`, which latches once per session, and the database
 * keeps one row per install per day.
 */
describe('useScreenSignal', () => {
  beforeEach(() => vi.mocked(trackFeatureSignal).mockClear());

  it('counts the screen when it mounts', () => {
    renderHook(() => useScreenSignal('screen_bulletin'));
    expect(trackFeatureSignal).toHaveBeenCalledWith('screen_bulletin');
  });

  // A surface that is mounted but closed (the extension's search overlay, the
  // vývěska pin) has not been shown.
  it('waits until the surface is actually open', () => {
    const { rerender } = renderHook(({ open }) => useScreenSignal('screen_search', open), {
      initialProps: { open: false },
    });
    expect(trackFeatureSignal).not.toHaveBeenCalled();

    rerender({ open: true });
    expect(trackFeatureSignal).toHaveBeenCalledWith('screen_search');
  });

  // The extension boots on the calendar and then restores the saved view from
  // IndexedDB; a calendar that is replaced within moments was never looked at.
  describe('with a delay', () => {
    afterEach(() => vi.useRealTimers());

    it('counts only once the screen has stayed up for the delay', () => {
      vi.useFakeTimers();
      renderHook(() => useScreenSignal('screen_calendar', true, 1000));
      vi.advanceTimersByTime(999);
      expect(trackFeatureSignal).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(trackFeatureSignal).toHaveBeenCalledWith('screen_calendar');
    });

    it('does not count a screen replaced before the delay', () => {
      vi.useFakeTimers();
      const { unmount } = renderHook(() => useScreenSignal('screen_calendar', true, 1000));
      vi.advanceTimersByTime(300);
      unmount();
      vi.advanceTimersByTime(5000);
      expect(trackFeatureSignal).not.toHaveBeenCalled();
    });
  });

  it('does not count again on a re-render while open', () => {
    const { rerender } = renderHook(() => useScreenSignal('screen_menu'));
    rerender();
    expect(trackFeatureSignal).toHaveBeenCalledTimes(1);
  });
});
