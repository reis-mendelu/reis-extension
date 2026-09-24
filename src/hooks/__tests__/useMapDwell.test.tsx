import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { trackFeatureSignal } = vi.hoisted(() => ({
  trackFeatureSignal: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
}));
vi.mock('../../api/featureUsage', () => ({
  trackFeatureSignal: (...a: unknown[]) => trackFeatureSignal(...a),
}));

import { useMapDwell, MAP_DWELL_MS } from '../useMapDwell';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useMapDwell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('counts nothing until the map has been on screen for three seconds', () => {
    renderHook(() => useMapDwell());

    vi.advanceTimersByTime(MAP_DWELL_MS - 1);

    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  it('counts the install once the three seconds are up', () => {
    renderHook(() => useMapDwell());

    vi.advanceTimersByTime(MAP_DWELL_MS);

    expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('map_dwell_3s');
  });

  // Opening the map tab and leaving again is the case the threshold exists to
  // exclude — it must not be counted after the fact by a timer left running.
  it('counts nothing when the map is left before the three seconds', () => {
    const { unmount } = renderHook(() => useMapDwell());

    vi.advanceTimersByTime(MAP_DWELL_MS - 500);
    unmount();
    vi.advanceTimersByTime(MAP_DWELL_MS);

    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  // A backgrounded tab is not being looked at. Its timers are throttled by the
  // browser anyway, so elapsed time there is not time spent on the map.
  it('counts nothing while the tab is hidden', () => {
    renderHook(() => useMapDwell());

    vi.advanceTimersByTime(1000);
    setVisibility('hidden');
    vi.advanceTimersByTime(MAP_DWELL_MS * 3);

    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  it('starts the three seconds over when the tab comes back', () => {
    renderHook(() => useMapDwell());

    vi.advanceTimersByTime(2000);
    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(MAP_DWELL_MS - 1);
    expect(trackFeatureSignal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('map_dwell_3s');
  });

  it('does not start counting while the tab is already hidden on mount', () => {
    setVisibility('hidden');

    renderHook(() => useMapDwell());
    vi.advanceTimersByTime(MAP_DWELL_MS * 2);

    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });
});
