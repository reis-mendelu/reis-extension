import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWatchdog } from '../data/useWatchdog';
import type { ExamTerm } from '../../types/exams';

vi.mock('../../api/exams', () => ({
    triggerWatchdog: vi.fn(async () => ({ success: true })),
}));
const { triggerWatchdog } = await import('../../api/exams');

const term = (url?: string): ExamTerm => ({ id: 't1', date: '01.06.2026', time: '09:00', watchdogUrl: url });

describe('useWatchdog', () => {
    beforeEach(() => vi.clearAllMocks());

    it('reads armed=false from an aktivace=1 URL', () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        expect(result.current.armed).toBe(false);
    });

    it('reads armed=true from an aktivace=2 URL', () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=2')));
        expect(result.current.armed).toBe(true);
    });

    it('flips optimistically and calls triggerWatchdog', async () => {
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        await act(async () => { await result.current.toggle(); });
        expect(triggerWatchdog).toHaveBeenCalledWith('https://is/x?aktivace=1');
        await waitFor(() => expect(result.current.armed).toBe(true));
        expect(result.current.feedback).toBe('activated');
    });

    it('rolls the optimistic flip back when the request fails', async () => {
        vi.mocked(triggerWatchdog).mockResolvedValueOnce({ success: false, error: 'nope' });
        const { result } = renderHook(() => useWatchdog(term('https://is/x?aktivace=1')));
        await act(async () => { await result.current.toggle(); });
        await waitFor(() => expect(result.current.armed).toBe(false));
        expect(result.current.feedback).toBe('failed');
        expect(result.current.errorMessage).toBe('nope');
    });

    it('does nothing when the term has no watchdog URL', async () => {
        const { result } = renderHook(() => useWatchdog(term(undefined)));
        await act(async () => { await result.current.toggle(); });
        expect(triggerWatchdog).not.toHaveBeenCalled();
    });
});
