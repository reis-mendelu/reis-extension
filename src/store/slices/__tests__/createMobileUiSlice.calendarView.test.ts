import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { createMobileUiSlice } from '../createMobileUiSlice';
import type { MobileUiSlice } from '../../types';
import { IndexedDBService } from '../../../services/storage';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * The calendar's day/week choice is asked once and then saved on the device
 * (spec 2026-10-09). What the calendar SHOWS is separate from what is SAVED:
 * trying a view in the chooser, or peeking at one day from the week, must not
 * overwrite the choice. IndexedDB, never localStorage (Iron Rules).
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

  it('opens on the day view, not yet hydrated', () => {
    expect(state.mobileCalendarView).toBe('day');
    expect(state.savedCalendarView).toBe('day');
    expect(state.calendarViewChosen).toBeNull();
  });

  it('hydrates a saved week as chosen', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('week');
    await state.hydrateCalendarView({ demo: false });
    expect(IndexedDBService.get).toHaveBeenCalledWith('meta', 'calendar_view');
    expect(state.calendarViewChosen).toBe(true);
    expect(state.savedCalendarView).toBe('week');
    expect(state.mobileCalendarView).toBe('week');
  });

  it('a missing key means the student never chose', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    await state.hydrateCalendarView({ demo: false });
    expect(state.calendarViewChosen).toBe(false);
    expect(state.mobileCalendarView).toBe('day');
  });

  it('an unknown stored value is asked again rather than trusted', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue('month');
    await state.hydrateCalendarView({ demo: false });
    expect(state.calendarViewChosen).toBe(false);
  });

  it('demo mode counts as chosen and reads nothing', async () => {
    await state.hydrateCalendarView({ demo: true });
    expect(state.calendarViewChosen).toBe(true);
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('showing a view changes the screen and writes nothing', () => {
    state.showCalendarView('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(state.savedCalendarView).toBe('day');
    expect(IndexedDBService.set).not.toHaveBeenCalled();
  });

  it('saving writes the choice and marks it chosen', () => {
    state.saveCalendarView('week');
    expect(state.savedCalendarView).toBe('week');
    expect(state.mobileCalendarView).toBe('week');
    expect(state.calendarViewChosen).toBe(true);
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', 'calendar_view', 'week');
  });

  it('restoring puts the saved view back after a peek', () => {
    state.saveCalendarView('week');
    state.showCalendarView('day');
    state.restoreCalendarView();
    expect(state.mobileCalendarView).toBe('week');
  });
});
