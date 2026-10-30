import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * Den or Týden is remembered on the device: whatever the student last switched
 * to is where the calendar opens (spec 2026-10-30). There is no chooser and no
 * separate "saved" view — what is shown IS the choice.
 *
 * The key is `calendar_view_v2`, never the 5.4.0 `calendar_view`: everyone
 * opens on Den after the update, so a choice from before #540 must not be read.
 * With no key, a phone opens on Den and an iPad on Týden.
 * IndexedDB, never localStorage (Iron Rules).
 */
describe('createMobileUiSlice — calendar view', () => {
  let state: MobileUiSlice;
  let set: Mock & Parameters<typeof createMobileUiSlice>[0];
  let get: Mock & Parameters<typeof createMobileUiSlice>[1];

  beforeEach(() => {
    vi.mocked(IndexedDBService.get).mockReset();
    vi.mocked(IndexedDBService.set).mockClear();
    set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state) as unknown as typeof get;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createMobileUiSlice(set, get, {} as any);
  });

  it('opens on the day view before hydration', () => {
    expect(state.mobileCalendarView).toBe('day');
  });

  it('hydrates the remembered view from the v2 key', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('week');
    await state.hydrateCalendarView({ demo: false, wide: false });
    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'calendar_view_v2');
    expect(state.mobileCalendarView).toBe('week');
  });

  it('never reads the 5.4.0 key', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateCalendarView({ demo: false, wide: false });
    expect(IndexedDBService.get).not.toHaveBeenCalledWith('meta', 'calendar_view');
  });

  it('with nothing remembered, a phone opens on Den', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateCalendarView({ demo: false, wide: false });
    expect(state.mobileCalendarView).toBe('day');
  });

  it('with nothing remembered, an iPad opens on Týden', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateCalendarView({ demo: false, wide: true });
    expect(state.mobileCalendarView).toBe('week');
  });

  it('an unknown stored value falls back to the default', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('month');
    await state.hydrateCalendarView({ demo: false, wide: false });
    expect(state.mobileCalendarView).toBe('day');
  });

  it('demo mode reads nothing and takes the default', async () => {
    await state.hydrateCalendarView({ demo: true, wide: true });
    expect(IndexedDBService.get).not.toHaveBeenCalled();
    expect(state.mobileCalendarView).toBe('week');
  });

  it('switching shows the view and remembers it', () => {
    state.setMobileCalendarView('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'calendar_view_v2', 'week');
  });
});
