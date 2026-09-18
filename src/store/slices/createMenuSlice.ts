import type { MenuSlice, AppSlice } from '../types';
import { fetchMenu } from '../../api/menu';

/**
 * Which request is the newest. Module-scoped rather than store state because
 * nothing renders it and nothing outside this file may reason about it — it
 * exists only so a response can ask "am I still the one being waited for".
 *
 * It answers that question where `menuLanguage` cannot: two requests for the
 * SAME language carry the same stamp, so a cz → en → cz cycle leaves an
 * obsolete Czech request that a language-only check waves through. The stamp
 * still owns the REQUEST guard, which is a different question — "is the menu
 * in hand the right one" — and a counter must not be used for that, or two
 * triggers for one language would stop collapsing into a single request.
 */
let latestRequest = 0;

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

    const request = ++latestRequest;
    set({ menuLoading: true, menuError: false, menuLanguage: lang });
    try {
      const data = await fetchMenu(lang);
      // Something started a newer request while this was in flight, so this
      // body is for a question nobody is asking any more. Dropping it matters
      // in both directions: committing it would show a menu the student has
      // moved on from AND clear `menuLoading` out from under the request that
      // is still pending. The newest request owns the flags from here.
      if (request !== latestRequest) return;
      set({ menu: data, menuLoading: false });
    } catch {
      // The same, and this is the half that bites hardest: a stale rejection
      // used to raise `menuError` for a request that then succeeded, leaving
      // good data behind an "unavailable" state, because the popover reads
      // `menuError` before it reads `menu`.
      if (request !== latestRequest) return;
      set({ menuLoading: false, menuError: true });
    }
  },
});
