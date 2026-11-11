import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFileLastVisit } from '../useFileLastVisit';
import { IndexedDBService } from '../../../services/storage/IndexedDBService';

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const A = new Date(2026, 9, 10).getTime();

describe('useFileLastVisit', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await IndexedDBService.set('meta', 'file_last_visit_ALG', A);
    await IndexedDBService.delete('meta', 'file_last_visit_MAT');
  });

  it('reads the last visit, null on a first one', async () => {
    const { result, rerender } = renderHook(({ code }) => useFileLastVisit(code, true), {
      initialProps: { code: 'ALG' },
    });
    await waitFor(() => expect(result.current).toBe(A));
    rerender({ code: 'MAT' });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("never returns the previous subject's visit after a switch", async () => {
    const { result, rerender } = renderHook(({ code }) => useFileLastVisit(code, true), {
      initialProps: { code: 'ALG' },
    });
    await waitFor(() => expect(result.current).toBe(A));
    rerender({ code: 'MAT' });
    // Same render as the switch, before the new read lands.
    expect(result.current).toBeUndefined();
  });

  it('falls back to no badge when storage fails', async () => {
    vi.spyOn(IndexedDBService, 'get').mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useFileLastVisit('ALG', true));
    await waitFor(() => expect(result.current).toBeNull());
  });
});
