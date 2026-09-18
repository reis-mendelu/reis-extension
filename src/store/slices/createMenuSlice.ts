import type { MenuSlice, AppSlice } from '../types';
import { fetchMenu } from '../../api/menu';

export const createMenuSlice: AppSlice<MenuSlice> = (set, get) => ({
  menu: null,
  menuLoading: false,
  menuError: false,
  menuLanguage: null,
  fetchMenu: async () => {
    // The menu comes from skm.mendelu.cz through the content-script proxy, and
    // in demo mode there is nothing behind that proxy: `fetchViaProxy` posts
    // and waits out its full 30-second timeout. Every other IS-facing call
    // already returns early in demo (api/feedback.ts, api/eventRsvp.ts); this
    // one did not, and now that the calendar carries a jídelníček card the demo
    // boot sat on a pending request for half a minute.
    if (get().demoMode) return;

    // The REQUEST guard, and it belongs here rather than in the callers.
    // `!get().menu` used to gate only the loading flag, so every caller reached
    // the network. The callers are triggers; the store decides whether a
    // trigger becomes a request.
    //
    // Both halves are qualified BY LANGUAGE, because the menu is scraped per
    // language from two different SKM pages and a Czech menu is not an answer
    // to a request for the English one. Unqualified, the guard could not tell
    // "we already have it" from "we have the wrong one", so a menu fetched
    // under the previous language stuck for the life of the store — which is
    // what made the old ordering bugs permanent rather than merely wasteful.
    //
    // `menuError` is deliberately not part of it: a failed attempt should be
    // retryable.
    const lang = get().language;
    if (get().menuLanguage === lang && (get().menu || get().menuLoading)) return;

    set({ menuLoading: true, menuError: false, menuLanguage: lang });
    try {
      const data = await fetchMenu(lang);
      // A language change while this was in flight started a newer request and
      // re-stamped `menuLanguage`. This body is for the language the student
      // has already left, so it is dropped — writing it would both show the
      // wrong menu and, before the stamp existed, close the guard against the
      // correction. The newer request owns `menuLoading` from here.
      if (get().menuLanguage !== lang) return;
      set({ menu: data, menuLoading: false });
    } catch {
      if (get().menuLanguage !== lang) return;
      set({ menuLoading: false, menuError: true });
    }
  },
});
