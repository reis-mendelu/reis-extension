import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));

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
    // The middle stop: the map sheet opens with the campus events already
    // visible, instead of a blank peek band the student had to drag up.
    expect(state.mapSheetState).toBe('half');
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

  /**
   * Tapping a second classmate while the first one's card is open is a lateral
   * move, not a descent — stacking put two person cards on screen at once, the
   * new one sliding up over the old. Same-kind pushes swap in place, and the
   * swap is ONE store update so a frame with both never renders.
   */
  it('pushSheet swaps in place when the top sheet is already the same kind', () => {
    state.pushSheet({ kind: 'subjectDrawer', courseCode: 'EBC-IV' });
    state.pushSheet({ kind: 'person', personId: 'p1' });
    state.pushSheet({ kind: 'person', personId: 'p2' });
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['subjectDrawer', 'person']);
    expect(state.mobileSheets.at(-1)).toMatchObject({ personId: 'p2' });
  });

  /** The swap must not eat the way back to whatever opened the first card. */
  it('leaves the sheet underneath alone when it swaps', () => {
    state.pushSheet({ kind: 'subjectDrawer', courseCode: 'EBC-IV' });
    state.pushSheet({ kind: 'person', personId: 'p1' });
    state.pushSheet({ kind: 'person', personId: 'p2' });
    state.popSheet();
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['subjectDrawer']);
  });

  it('still stacks when the kinds differ', () => {
    state.pushSheet({ kind: 'profile' });
    state.pushSheet({ kind: 'eduroam' });
    expect(state.mobileSheets.map((s) => s.kind)).toEqual(['profile', 'eduroam']);
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

  describe('welcome', () => {
    it('starts unknown, so a returning student never sees a flash of the welcome', () => {
      expect(state.welcomeSeen).toBeNull();
    });

    it('hydrates to false when the key was never written (first run, or an install from before the screen existed)', async () => {
      vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
      await state.hydrateWelcome({ demo: false });
      expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'welcome_dismissed');
      expect(state.welcomeSeen).toBe(false);
    });

    it('hydrates to true once dismissed', async () => {
      vi.mocked(IndexedDBService.get).mockResolvedValue(true);
      await state.hydrateWelcome({ demo: false });
      expect(state.welcomeSeen).toBe(true);
    });

    it('treats demo mode as seen without touching storage', async () => {
      vi.mocked(IndexedDBService.get).mockClear();
      await state.hydrateWelcome({ demo: true });
      expect(state.welcomeSeen).toBe(true);
      expect(IndexedDBService.get).not.toHaveBeenCalled();
    });

    it('dismissWelcome hides the screen immediately and persists the flag', async () => {
      await state.dismissWelcome();
      expect(state.welcomeSeen).toBe(true);
      expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'welcome_dismissed', true);
    });
  });
});
