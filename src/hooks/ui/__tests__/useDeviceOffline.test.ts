import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceOffline } from '../useDeviceOffline';

function setOnLine(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDeviceOffline', () => {
  it('reads navigator.onLine on mount', () => {
    setOnLine(false);
    const { result } = renderHook(() => useDeviceOffline());
    expect(result.current).toBe(true);
  });

  it('follows the connection as it drops and comes back', () => {
    setOnLine(true);
    const { result } = renderHook(() => useDeviceOffline());
    expect(result.current).toBe(false);

    setOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(true);

    setOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(false);
  });
});
