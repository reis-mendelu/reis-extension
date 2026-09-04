import type { MenuSlice, AppSlice } from '../types';
import { fetchMenu } from '../../api/menu';

export const createMenuSlice: AppSlice<MenuSlice> = (set, get) => ({
  menu: null,
  menuLoading: false,
  menuError: false,
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
    // the network — and the desktop has two of them. The component effects are
    // triggers; the store decides whether a trigger becomes a request.
    //
    // Safe against a language switch because that clears `menu`
    // (useAppStore.ts), which is what reopens this guard. `menuError` is
    // deliberately not part of it: a failed attempt should be retryable.
    if (get().menu || get().menuLoading) return;
    set({ menuLoading: true });
    set({ menuError: false });
    try {
      const data = await fetchMenu(get().language);
      set({ menu: data, menuLoading: false });
    } catch {
      set({ menuLoading: false, menuError: true });
    }
  },
});
