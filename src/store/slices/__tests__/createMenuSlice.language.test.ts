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

/**
 * Both PR reviewers found this one, independently, and they were right.
 *
 * The language stamp alone cannot order two requests for the SAME language.
 * A student who switches cz → en → cz before the first request settles leaves
 * an obsolete Czech request in flight whose stamp matches the newest Czech
 * one, so it passes a language-only check and commits over a request that is
 * still pending. A generation counter is what actually answers "is this the
 * newest request", and the language stamp goes on doing what it is for:
 * telling the REQUEST guard whether the menu in hand is the right one.
 */
describe('createMenuSlice — only the newest request may commit', () => {
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

  it('ignores an obsolete same-language response that resolves late', async () => {
    let releaseStaleCz!: (v: OutletMenu[]) => void;
    let releaseFreshCz!: (v: OutletMenu[]) => void;
    const STALE: OutletMenu[] = [
      { outlet: 'STALE', days: [{ date: '8. 9.', soup: 'Old', mainDishes: [] }] },
    ];

    vi.mocked(apiFetchMenu).mockReturnValueOnce(
      new Promise((r) => {
        releaseStaleCz = r;
      })
    );
    const staleCz = useAppStore.getState().fetchMenu();

    // cz → en → cz, all while the first Czech request is still out.
    useAppStore.setState({ language: 'en' } as never);
    vi.mocked(apiFetchMenu).mockReturnValueOnce(new Promise(() => {}));
    void useAppStore.getState().fetchMenu();

    useAppStore.setState({ language: 'cz' } as never);
    vi.mocked(apiFetchMenu).mockReturnValueOnce(
      new Promise((r) => {
        releaseFreshCz = r;
      })
    );
    const freshCz = useAppStore.getState().fetchMenu();

    releaseStaleCz(STALE);
    await staleCz;
    // The newest request is still pending, so nothing may have landed yet.
    expect(useAppStore.getState().menu).toBeNull();
    expect(useAppStore.getState().menuLoading).toBe(true);

    releaseFreshCz(CZ);
    await freshCz;
    expect(useAppStore.getState().menu).toEqual(CZ);
    expect(useAppStore.getState().menuLoading).toBe(false);
  });

  // The nastier half: a stale REJECTION used to raise menuError for a request
  // that then succeeded. `menu` was good and the popover still rendered
  // "Menu není k dispozici", because it checks menuError first.
  it('ignores an obsolete same-language rejection', async () => {
    let failStaleCz!: (e: Error) => void;
    let releaseFreshCz!: (v: OutletMenu[]) => void;

    vi.mocked(apiFetchMenu).mockReturnValueOnce(
      new Promise((_, reject) => {
        failStaleCz = reject;
      })
    );
    const staleCz = useAppStore.getState().fetchMenu();

    useAppStore.setState({ language: 'en' } as never);
    vi.mocked(apiFetchMenu).mockReturnValueOnce(new Promise(() => {}));
    void useAppStore.getState().fetchMenu();

    useAppStore.setState({ language: 'cz' } as never);
    vi.mocked(apiFetchMenu).mockReturnValueOnce(
      new Promise((r) => {
        releaseFreshCz = r;
      })
    );
    const freshCz = useAppStore.getState().fetchMenu();

    failStaleCz(new Error('the request the student already left'));
    await staleCz;
    expect(useAppStore.getState().menuError).toBe(false);

    releaseFreshCz(CZ);
    await freshCz;
    expect(useAppStore.getState().menu).toEqual(CZ);
    expect(useAppStore.getState().menuError).toBe(false);
  });
});
