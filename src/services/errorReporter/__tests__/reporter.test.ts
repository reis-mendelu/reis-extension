import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installErrorReporter } from '../reporter';
import { supabase } from '../../spolky/supabaseClient';

vi.mock('../../spolky/supabaseClient', () => ({
    supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
}));

const fireError = (overrides: Partial<ErrorEvent> = {}) => {
    const ev = new ErrorEvent('error', {
        message: overrides.message ?? 'something broke',
        filename: overrides.filename ?? 'main.js',
        lineno: overrides.lineno ?? 42,
        error: overrides.error ?? new TypeError(overrides.message ?? 'something broke'),
        cancelable: true,
    });
    window.dispatchEvent(ev);
};

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('installErrorReporter', () => {
    let cleanup: (() => void) | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        // Each test calls installErrorReporter() which creates a fresh closure,
        // so per-session state (seen set, reportsSent) resets automatically.
        Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    });

    afterEach(() => {
        cleanup?.();
        cleanup = null;
    });

    it('calls report_error RPC with exactly the seven disclosed fields', async () => {
        cleanup = installErrorReporter(() => true);
        fireError({ message: 'boom', filename: 'a.js', lineno: 7 });
        await flush();

        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        const [name, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(name).toBe('report_error');
        expect(Object.keys(args).sort()).toEqual(
            [
                'p_browser_name',
                'p_browser_version',
                'p_error_message',
                'p_error_type',
                'p_ext_version',
                'p_file_path',
                'p_line_number',
            ].sort(),
        );
        expect(args.p_error_type).toBe('TypeError');
        expect(args.p_error_message).toBe('boom');
        expect(args.p_file_path).toBe('a.js');
        expect(args.p_line_number).toBe(7);
        expect(args.p_ext_version).toBe('1.0.0'); // from chrome.runtime mock in setup.ts
    });

    it('does not call RPC when getEnabled returns false', async () => {
        cleanup = installErrorReporter(() => false);
        fireError();
        await flush();
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('dedupes identical errors within a session', async () => {
        cleanup = installErrorReporter(() => true);
        fireError({ message: 'same', filename: 'f.js', lineno: 1 });
        fireError({ message: 'same', filename: 'f.js', lineno: 1 });
        fireError({ message: 'same', filename: 'f.js', lineno: 1 });
        await flush();
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
    });

    it('stops after the per-session cap (5) is reached', async () => {
        cleanup = installErrorReporter(() => true);
        for (let i = 0; i < 10; i++) {
            fireError({ message: `unique-${i}`, filename: 'f.js', lineno: i });
        }
        await flush();
        expect(supabase.rpc).toHaveBeenCalledTimes(5);
    });

    it('swallows RPC rejections without throwing', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network'));
        cleanup = installErrorReporter(() => true);
        expect(() => fireError()).not.toThrow();
        await flush();
    });

    it('skips when navigator.webdriver is true', async () => {
        const original = (navigator as unknown as { webdriver: boolean }).webdriver;
        Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
        cleanup = installErrorReporter(() => true);
        fireError();
        await flush();
        expect(supabase.rpc).not.toHaveBeenCalled();
        Object.defineProperty(navigator, 'webdriver', { value: original, configurable: true });
    });

    it('drops report when sanitized message is empty', async () => {
        cleanup = installErrorReporter(() => true);
        fireError({ message: '   ', filename: 'a.js', lineno: 1 });
        await flush();
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('handles unhandledrejection events', async () => {
        cleanup = installErrorReporter(() => true);
        const reason = new Error('promise blew up');
        const ev = new Event('unhandledrejection') as PromiseRejectionEvent;
        Object.defineProperty(ev, 'reason', { value: reason, configurable: true });
        window.dispatchEvent(ev);
        await flush();
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        const [, args] = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(args.p_error_type).toBe('Error');
        expect(args.p_error_message).toBe('promise blew up');
    });

    it('cleanup() detaches the listeners', async () => {
        cleanup = installErrorReporter(() => true);
        cleanup();
        cleanup = null;
        fireError();
        await flush();
        expect(supabase.rpc).not.toHaveBeenCalled();
    });
});
