import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSpolkySettings } from '../useSpolkySettings';
import { useAppStore } from '../../store/useAppStore';

// The loading and auto-follow logic (faculty defaults, ESN for Erasmus, the
// empty-list retry, renamed-id migration) moved into
// `createFollowSlice`/`loadFollows` — see
// `src/store/slices/__tests__/createFollowSlice.test.ts` for that coverage.
// This hook is now a thin reader, so its own test only checks the reading and
// the write path it exposes.
describe('useSpolkySettings', () => {
  beforeEach(() => {
    useAppStore.setState({ followed: [], followsLoaded: false });
  });

  it('is loading until the store has resolved follows', () => {
    const { result } = renderHook(() => useSpolkySettings());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.subscribedAssociations).toEqual([]);
  });

  it('reads the followed list once the store has loaded it', () => {
    useAppStore.setState({ followed: ['supef', 'esn'], followsLoaded: true });

    const { result } = renderHook(() => useSpolkySettings());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.subscribedAssociations).toEqual(['supef', 'esn']);
  });

  it('isSubscribed reflects the followed list', () => {
    useAppStore.setState({ followed: ['supef'], followsLoaded: true });

    const { result } = renderHook(() => useSpolkySettings());

    expect(result.current.isSubscribed('supef')).toBe(true);
    expect(result.current.isSubscribed('esn')).toBe(false);
  });

  it('toggleAssociation delegates to the store action', () => {
    const toggleFollow = vi.fn();
    useAppStore.setState({ followed: [], followsLoaded: true, toggleFollow });

    const { result } = renderHook(() => useSpolkySettings());
    result.current.toggleAssociation('esn');

    expect(toggleFollow).toHaveBeenCalledWith('esn');
  });
});
