import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  // `isNarrow` is SEEDED from matchMedia, not defaulted — that is the whole
  // point of the slice, so the first frame does not render the desktop tree and
  // throw it away. This asserted `false`, which was never a statement about the
  // slice: it was a statement about happy-dom opening a 1024px window. The
  // suite now runs at 390 (see src/test/setup.ts), so the honest assertion is
  // that the seed followed the viewport it was given.
  it('seeds itself from the viewport rather than defaulting', () => {
    expect(state.isTouch).toBe(false);
    expect(state.isNarrow).toBe(window.matchMedia('(max-width: 767px)').matches);
    expect(state.isNarrow).toBe(true);
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

  describe('initial isTouch/isNarrow seeding', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    function stubMatchMedia(matchingQuery: string) {
      window.matchMedia = vi.fn((query: string) => ({
        matches: query === matchingQuery,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any;
    }

    it('seeds isTouch true when the browser reports a coarse pointer, exactly the AppShell query', () => {
      stubMatchMedia('(pointer: coarse)');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fresh = createViewportSlice(vi.fn(), vi.fn(), {} as any);
      expect(fresh.isTouch).toBe(true);
      expect(fresh.isNarrow).toBe(false);
    });

    it('seeds isNarrow true when the browser reports a narrow viewport, exactly the AppShell query', () => {
      stubMatchMedia('(max-width: 767px)');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fresh = createViewportSlice(vi.fn(), vi.fn(), {} as any);
      expect(fresh.isNarrow).toBe(true);
      expect(fresh.isTouch).toBe(false);
    });

    it('seeds both false when neither query matches (desktop)', () => {
      stubMatchMedia('(never: matches)');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fresh = createViewportSlice(vi.fn(), vi.fn(), {} as any);
      expect(fresh.isTouch).toBe(false);
      expect(fresh.isNarrow).toBe(false);
    });
  });
});
