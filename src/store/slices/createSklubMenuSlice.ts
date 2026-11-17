import type { AppSlice } from '../types';
import type { VenueLunchDay } from '../../types/campusMap';
import { fetchSklubMenu } from '../../api/sklubMenu';
import { logError } from '../../utils/reportError';

/**
 * S-klub Pixie's week, scraped on the device from sklubpixie.cz exactly like
 * SKM's menu (`createMenuSlice`), and read by the Jídelníček's S-klub tab and
 * the café's card on the map, so the two always agree.
 *
 * Asked for by `loadSocietyPins` once the venues include S-klub, never by a
 * component: before the release creates the `venues` table, or after the café
 * is switched off, nothing reaches sklubpixie.cz. That load runs at boot and,
 * in the apps, again on resume (`refreshMapEventsIfStale`), which gives this
 * the menu's second chance with the same gap.
 *
 * Czech only — the café publishes no English menu — so unlike SKM's there is
 * no language to stamp it with.
 */
export interface SklubMenuSlice {
  /** The week's days by Prague date ('YYYY-MM-DD'); empty until fetched. */
  sklubMenu: VenueLunchDay[];
  sklubMenuFetchedAt: number | null;
  /**
   * Fetch, unless a menu in hand is younger than `minGapMs`. One request at a
   * time; a failed or empty answer keeps the week in hand.
   */
  refreshSklubMenu: (minGapMs: number) => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const createSklubMenuSlice: AppSlice<SklubMenuSlice> = (set, get) => ({
  sklubMenu: [],
  sklubMenuFetchedAt: null,
  refreshSklubMenu: (minGapMs) => {
    const s = get();
    // Nothing behind the proxy in demo mode: the request would wait out its
    // full timeout (createMenuSlice.fetchMenu says why).
    if (s.demoMode) return Promise.resolve();
    if (inFlight) return inFlight;
    const fresh =
      s.sklubMenu.length > 0 &&
      s.sklubMenuFetchedAt !== null &&
      Date.now() - s.sklubMenuFetchedAt < minGapMs;
    if (fresh) return Promise.resolve();
    inFlight = (async () => {
      try {
        const days = await fetchSklubMenu();
        // An empty parse is the page having changed shape, not a week with no
        // lunch: keep what is in hand, and say so in the local log.
        if (days.length === 0) throw new Error('no menu found on the page');
        set({ sklubMenu: days, sklubMenuFetchedAt: Date.now() });
      } catch (e) {
        logError('SklubMenu.refresh', e);
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
});
