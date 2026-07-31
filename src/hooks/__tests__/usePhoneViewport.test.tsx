import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePhoneViewport } from '../ui/usePhoneViewport';
import { useAppStore } from '../../store/useAppStore';

describe('usePhoneViewport', () => {
  beforeEach(() => {
    useAppStore.setState({ isTouch: false, isNarrow: false, devPhoneOverride: null });
  });

  it('is false on desktop', () => {
    const { result } = renderHook(() => usePhoneViewport());
    expect(result.current).toBe(false);
  });

  it('is true when touch and narrow', () => {
    useAppStore.setState({ isTouch: true, isNarrow: true });
    const { result } = renderHook(() => usePhoneViewport());
    expect(result.current).toBe(true);
  });

  it('honours the dev override', () => {
    useAppStore.setState({ devPhoneOverride: true });
    const { result } = renderHook(() => usePhoneViewport());
    expect(result.current).toBe(true);
  });
});
