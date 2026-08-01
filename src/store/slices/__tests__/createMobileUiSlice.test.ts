import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';

describe('createMobileUiSlice', () => {
  let state: MobileUiSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createMobileUiSlice(set, get, {} as any);
  });

  it('defaults to the calendar tab with no sheets open', () => {
    expect(state.mobileTab).toBe('calendar');
    expect(state.mobileSheets).toEqual([]);
    expect(state.mapSheetState).toBe('peek');
    expect(state.mapTab).toBe('akce');
    expect(state.devPhoneOverride).toBeNull();
  });

  it('setMobileTab switches the tab', () => {
    state.setMobileTab('exams');
    expect(state.mobileTab).toBe('exams');
  });

  it('pushSheet stacks sheets in order', () => {
    state.pushSheet({ kind: 'profile' });
    state.pushSheet({ kind: 'person', personId: 'p1' });
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['profile', 'person']);
  });

  it('popSheet removes only the topmost sheet', () => {
    state.pushSheet({ kind: 'profile' });
    state.pushSheet({ kind: 'person', personId: 'p1' });
    state.popSheet();
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['profile']);
  });

  it('popSheet on an empty stack is a no-op', () => {
    state.popSheet();
    expect(state.mobileSheets).toEqual([]);
  });

  it('replaceSheet swaps the topmost sheet without growing the stack', () => {
    state.pushSheet({ kind: 'profile' });
    state.replaceSheet({ kind: 'eduroam' });
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['eduroam']);
  });

  it('closeAllSheets empties the stack', () => {
    state.pushSheet({ kind: 'profile' });
    state.pushSheet({ kind: 'docs' });
    state.closeAllSheets();
    expect(state.mobileSheets).toEqual([]);
  });

  it('switching tabs closes any open sheets', () => {
    state.pushSheet({ kind: 'profile' });
    state.setMobileTab('map');
    expect(state.mobileSheets).toEqual([]);
  });

  it('tracks map sheet state and tab', () => {
    state.setMapSheetState('expanded');
    state.setMapTab('knihovna');
    expect(state.mapSheetState).toBe('expanded');
    expect(state.mapTab).toBe('knihovna');
  });

  it('stores the dev phone override', () => {
    state.setDevPhoneOverride(true);
    expect(state.devPhoneOverride).toBe(true);
    state.setDevPhoneOverride(null);
    expect(state.devPhoneOverride).toBeNull();
  });
});
