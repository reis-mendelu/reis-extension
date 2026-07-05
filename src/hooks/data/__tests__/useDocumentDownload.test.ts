import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDocumentDownload } from '../useDocumentDownload';
import * as proxy from '../../../api/proxyClient';

describe('useDocumentDownload', () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.restoreAllMocks());

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
});
