import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTripleClick } from '../useTripleClick';

describe('useTripleClick', () => {
  it('fires after three clicks in the window', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useTripleClick(cb, 600));
    result.current();
    result.current();
    expect(cb).not.toHaveBeenCalled();
    result.current();
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('does not fire on two clicks', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useTripleClick(cb, 600));
    result.current();
    result.current();
    expect(cb).not.toHaveBeenCalled();
  });
});
