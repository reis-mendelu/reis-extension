import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useDocumentDownload } from '../useDocumentDownload';
import * as proxy from '../../../api/proxyClient';

describe('useDocumentDownload', () => {
  beforeEach(() => vi.useRealTimers());
  // cleanup() unmounts each hook so its done→idle timer-clearing effect runs —
  // otherwise the 2s setTimeout leaks and can fire mid-way through a later test.
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('drives a row loading → done on success', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocumentDownload());
    act(() => { result.current.run('potvrzeni-cz', 'https://x', 'f.pdf'); });
    expect(result.current.status['potvrzeni-cz']).toBe('loading');
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
  });

  it('drives a row loading → error on failure', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDocumentDownload());
    act(() => { result.current.run('reg-arch', 'https://x', 'f.pdf'); });
    await waitFor(() => expect(result.current.status['reg-arch']).toBe('error'));
  });

  it('ignores a ghost re-click on a row already in flight', async () => {
    const spy = vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    const { result } = renderHook(() => useDocumentDownload());
    act(() => {
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
      result.current.run('potvrzeni-cz', 'https://x', 'f.pdf');
    });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clears the pending done→idle timer on unmount', async () => {
    vi.spyOn(proxy, 'downloadDocument').mockResolvedValue(undefined);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useDocumentDownload());
    act(() => { result.current.run('potvrzeni-cz', 'https://x', 'f.pdf'); });
    await waitFor(() => expect(result.current.status['potvrzeni-cz']).toBe('done'));

    clearTimeoutSpy.mockClear();
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
