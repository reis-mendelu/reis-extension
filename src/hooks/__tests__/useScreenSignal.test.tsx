import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('does not count again on a re-render while open', () => {
    const { rerender } = renderHook(() => useScreenSignal('screen_menu'));
    rerender();
    expect(trackFeatureSignal).toHaveBeenCalledTimes(1);
  });
});
