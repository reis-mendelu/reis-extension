import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../useAppStore';
import type { OutletMenu } from '../../../types/menuTypes';

vi.mock('../../../api/menu', () => ({ fetchMenu: vi.fn() }));
import { fetchMenu as apiFetchMenu } from '../../../api/menu';

// The app fetched the jídelníček once, at boot. A boot fetch that failed — the
// app started while the phone dozed, with its network cut — left no menu and no
// chef hat for the whole session, and a long-lived process kept last week's
// menu after SKM moved on. Resume is the second chance (capacitor/startApp.ts).

const GAP = 10 * 60 * 1000;
const week = (day: string): OutletMenu[] => [
  { outlet: 'X', days: [{ date: `Pondělí ${day}`, soup: 'Polévka', mainDishes: ['Řízek'] }] },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T17:00:00'));
  vi.mocked(apiFetchMenu).mockReset();
  useAppStore.setState({
    menu: null,
    menuLoading: false,
    menuError: false,
    menuLanguage: null,
    menuFetchedAt: null,
    demoMode: false,
    language: 'cz',
  } as never);
});
afterEach(() => vi.useRealTimers());

describe('refreshMenuIfStale — the resume retry', () => {
  it('retries a boot fetch that failed, however recent', async () => {
    vi.mocked(apiFetchMenu).mockRejectedValueOnce(new Error('network cut while dozing'));
    await useAppStore.getState().fetchMenu();
    expect(useAppStore.getState().menuError).toBe(true);

    vi.mocked(apiFetchMenu).mockResolvedValueOnce(week('12. 10. 2026'));
    await useAppStore.getState().refreshMenuIfStale(GAP);
    expect(useAppStore.getState().menu).toEqual(week('12. 10. 2026'));
    expect(useAppStore.getState().menuError).toBe(false);
  });

  it('leaves a fresh menu alone inside the gap', async () => {
    vi.mocked(apiFetchMenu).mockResolvedValueOnce(week('5. 10. 2026'));
    await useAppStore.getState().fetchMenu();
    vi.setSystemTime(new Date('2026-10-10T17:05:00'));
    await useAppStore.getState().refreshMenuIfStale(GAP);
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
  });

  it('replaces a menu older than the gap, keeping the old one on screen meanwhile', async () => {
    vi.mocked(apiFetchMenu).mockResolvedValueOnce(week('5. 10. 2026'));
    await useAppStore.getState().fetchMenu();
    vi.setSystemTime(new Date('2026-10-12T08:00:00'));

    let resolve!: (m: OutletMenu[]) => void;
    vi.mocked(apiFetchMenu).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const pending = useAppStore.getState().refreshMenuIfStale(GAP);
    expect(useAppStore.getState().menu).toEqual(week('5. 10. 2026'));
    resolve(week('12. 10. 2026'));
    await pending;
    expect(useAppStore.getState().menu).toEqual(week('12. 10. 2026'));
  });

  it('keeps the menu it has when a refresh fails, and does not flag it unavailable', async () => {
    vi.mocked(apiFetchMenu).mockResolvedValueOnce(week('5. 10. 2026'));
    await useAppStore.getState().fetchMenu();
    vi.setSystemTime(new Date('2026-10-12T08:00:00'));
    vi.mocked(apiFetchMenu).mockRejectedValueOnce(new Error('offline'));
    await useAppStore.getState().refreshMenuIfStale(GAP);
    expect(useAppStore.getState().menu).toEqual(week('5. 10. 2026'));
    expect(useAppStore.getState().menuError).toBe(false);
  });

  it('does not stack a second request on one in flight', async () => {
    vi.mocked(apiFetchMenu).mockReturnValueOnce(new Promise(() => {}));
    void useAppStore.getState().fetchMenu();
    await useAppStore.getState().refreshMenuIfStale(GAP);
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
  });
});
