import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const get = vi.fn<(store: string, key: string) => Promise<unknown>>();
const set = vi.fn<(store: string, key: string, value: unknown) => Promise<void>>(async () => {});

vi.mock('@/services/storage', () => ({
  IndexedDBService: {
    get: (store: string, key: string) => get(store, key),
    set: (store: string, key: string, value: unknown) => set(store, key, value),
  },
}));

import { useOpenSemesters } from '../useOpenSemesters';

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * These cover the happy path around the unmount guard added to the IDB read.
 *
 * The failure the guard fixes cannot be reproduced here: it needs the read to
 * land after vitest has torn the ENVIRONMENT down (`window is not defined`),
 * and inside a live jsdom React treats a post-unmount setState as a harmless
 * no-op. So these assert the guard did not break the behaviour it wraps; the
 * guard itself is verified by the CI run staying green.
 */
describe('useOpenSemesters', () => {
  it('applies the stored open semesters', async () => {
    get.mockResolvedValue([2, 5]);
    const { result } = renderHook(() => useOpenSemesters(null));
    await vi.waitFor(() => expect(result.current.openSemesters.size).toBe(2));
    expect([...result.current.openSemesters]).toEqual([2, 5]);
  });

  it('falls back to an empty set when nothing is stored', async () => {
    get.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOpenSemesters(null));
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current.openSemesters.size).toBe(0);
  });

  it('falls back to an empty set when the read rejects', async () => {
    get.mockRejectedValue(new Error('idb closed'));
    const { result } = renderHook(() => useOpenSemesters(null));
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current.openSemesters.size).toBe(0);
  });

  it('toggles a semester open and shut', async () => {
    get.mockResolvedValue([]);
    const { result } = renderHook(() => useOpenSemesters(null));
    await vi.waitFor(() => expect(get).toHaveBeenCalled());

    result.current.handleToggle(3);
    await vi.waitFor(() => expect(result.current.openSemesters.has(3)).toBe(true));

    result.current.handleToggle(3);
    await vi.waitFor(() => expect(result.current.openSemesters.has(3)).toBe(false));
  });
});
