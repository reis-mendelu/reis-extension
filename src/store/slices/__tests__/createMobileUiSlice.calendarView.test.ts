import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * The calendar's day/week choice follows the device: a student who prefers the
 * week should not have to pick it again every time the app starts. IndexedDB,
 * never localStorage (Iron Rules).
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

  it('opens on the day view', () => {
    expect(state.mobileCalendarView).toBe('day');
  });

  it('switching remembers the choice on the device', () => {
    state.setMobileCalendarView('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'calendar_view', 'week');
  });

  it('hydrates a remembered week', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('week');
    await state.hydrateCalendarView();
    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'calendar_view');
    expect(state.mobileCalendarView).toBe('week');
  });

  it('anything else stored stays on the day view', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('month');
    await state.hydrateCalendarView();
    expect(state.mobileCalendarView).toBe('day');
  });
});
