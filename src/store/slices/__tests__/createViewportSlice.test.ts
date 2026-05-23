import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createViewportSlice } from '../createViewportSlice';
import type { ViewportSlice } from '../../types';

describe('createViewportSlice', () => {
    let state: ViewportSlice;
    let set: ReturnType<typeof vi.fn>;
    let get: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        set = vi.fn((updater) => {
            const patch = typeof updater === 'function' ? updater(state) : updater;
            state = { ...state, ...patch };
        });
        get = vi.fn(() => state);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state = createViewportSlice(set, get, {} as any);
    });

    it('initializes with default values', () => {
        expect(state.isTouch).toBe(false);
        expect(state.isNarrow).toBe(false);
        expect(state.isPortrait).toBe(true);
        expect(state.keyboardOpen).toBe(false);
        expect(typeof state.viewportHeight).toBe('number');
    });

    it('setViewport applies a partial patch', () => {
        state.setViewport({ isTouch: true, isNarrow: true });
        expect(state.isTouch).toBe(true);
        expect(state.isNarrow).toBe(true);
        expect(state.isPortrait).toBe(true);
    });

    it('setViewport is idempotent when no field changes', () => {
        const before = { ...state };
        state.setViewport({ isTouch: false });
        expect(state).toEqual(before);
    });

    it('setViewport detects keyboardOpen flip and viewportHeight change', () => {
        state.setViewport({ keyboardOpen: true, viewportHeight: 500 });
        expect(state.keyboardOpen).toBe(true);
        expect(state.viewportHeight).toBe(500);
    });
});
