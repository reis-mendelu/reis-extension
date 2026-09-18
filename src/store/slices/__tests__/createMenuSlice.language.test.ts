import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../useAppStore';
import type { OutletMenu } from '../../../types/menuTypes';

vi.mock('../../../api/menu', () => ({ fetchMenu: vi.fn() }));
import { fetchMenu as apiFetchMenu } from '../../../api/menu';

const CZ: OutletMenu[] = [
  { outlet: 'X', days: [{ date: '8. 9.', soup: 'Česnečka', mainDishes: [] }] },
];
const EN: OutletMenu[] = [
  { outlet: 'X', days: [{ date: '8. 9.', soup: 'Garlic soup', mainDishes: [] }] },
];

/**
 * The menu is scraped per language from two different SKM pages, so `menu` is
 * only meaningful together with the language it was fetched for. Without that
 * stamp the request guard cannot tell "we already have it" from "we have the
 * wrong one", and a wrong-language menu sticks for the life of the store.
 */
describe('createMenuSlice — the menu is stamped with its language', () => {
  beforeEach(() => {
    vi.mocked(apiFetchMenu).mockReset();
    useAppStore.setState({
      menu: null,
      menuLoading: false,
      menuError: false,
      menuLanguage: null,
      language: 'cz',
      demoMode: false,
    } as never);
  });

  it('fetches for the language in the store, and records which one', async () => {
    vi.mocked(apiFetchMenu).mockResolvedValue(CZ);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledWith('cz');
    expect(useAppStore.getState().menuLanguage).toBe('cz');
  });

  // The guard has to reopen on a language change even when `menu` was never
  // cleared — the caller should not have to remember to clear it first.
  it('refetches for a new language even with a menu already in hand', async () => {
    vi.mocked(apiFetchMenu).mockResolvedValue(CZ);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);

    vi.mocked(apiFetchMenu).mockResolvedValue(EN);
    useAppStore.setState({ language: 'en' } as never);
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenLastCalledWith('en');
    expect(useAppStore.getState().menu).toEqual(EN);
  });

  // CodeRabbit's finding, and it predates this branch: the old component effect
  // was gated on `!menuLoading` in exactly the same way. A boot request still in
  // flight when the language changes used to commit its stale body afterwards,
  // and the non-null guard then blocked the correction for good.
  it('discards a response whose language has been superseded', async () => {
    let releaseCz!: (v: OutletMenu[]) => void;
    vi.mocked(apiFetchMenu).mockReturnValueOnce(
      new Promise((resolve) => {
        releaseCz = resolve;
      })
    );
    const inFlight = useAppStore.getState().fetchMenu();

    // The language changes while that request is still out.
    useAppStore.setState({ language: 'en' } as never);
    vi.mocked(apiFetchMenu).mockResolvedValueOnce(EN);
    await useAppStore.getState().fetchMenu();

    // The stale Czech body lands last and must not win.
    releaseCz(CZ);
    await inFlight;

    expect(useAppStore.getState().menu).toEqual(EN);
    expect(useAppStore.getState().menuLanguage).toBe('en');
    expect(useAppStore.getState().menuLoading).toBe(false);
  });

  it('still collapses two triggers for the SAME language into one request', async () => {
    let release!: (v: OutletMenu[]) => void;
    vi.mocked(apiFetchMenu).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const first = useAppStore.getState().fetchMenu();
    await useAppStore.getState().fetchMenu();
    expect(apiFetchMenu).toHaveBeenCalledTimes(1);
    release(CZ);
    await first;
  });
});
