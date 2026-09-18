import canteenMenu from './fixtures/canteenMenu.json';
import { rebaseMenuFixture } from './menuFixture';
import { useAppStore } from '../src/store/useAppStore';
import { IndexedDBService } from '../src/services/storage';
import type { Language } from '../src/store/types';

/**
 * Give the dev webapp a canteen menu.
 *
 * `src/api/menu.ts` reaches skm.mendelu.cz through `fetchViaProxy`, which posts
 * to `window.parent` and waits for the CONTENT SCRIPT to answer. At
 * `localhost:3000` there is no parent and no content script, so the call never
 * resolves: `menuLoading` stays true forever and the jídelníček card and sheet
 * render nothing at all — indistinguishable from a component that is broken.
 *
 * Answering the proxy properly would mean trusting a same-origin reply in
 * `isTrustedProxyOrigin`, which is security-relevant production code and not
 * worth relaxing for a dev convenience. So the harness seeds the store instead,
 * from a real capture of the public menu.
 *
 * Only when the store has none, so nothing here can overwrite a real fetch —
 * inside the extension this module does not exist at all.
 *
 * Seeded WITH a `menuLanguage`, and that is load-bearing rather than tidy.
 * `createMenuSlice` qualifies its request guard by language, so a menu carrying
 * no stamp reads as "wrong language": the boot request fires anyway, fails for
 * the want of a content script, and `menuError` then hides the very data this
 * module just seeded. The stamp is read from the key `loadLanguage` reads, so
 * the harness satisfies the guard whichever language is stored. The fixture is
 * a Czech capture either way — this is a harness, and showing it beats an
 * "unavailable" box in the English UI.
 *
 * DEV-gated and in `dev/`, so it cannot reach the extension or the Capacitor
 * bundle.
 */
if (import.meta.env.DEV) {
  const menu = rebaseMenuFixture(canteenMenu, new Date());
  void (async () => {
    if (!menu.length || useAppStore.getState().menu) return;
    const stored = (await IndexedDBService.get('meta', 'reis_language').catch(() => undefined)) as
      Language | undefined;
    const menuLanguage: Language = stored === 'en' ? 'en' : 'cz';
    if (useAppStore.getState().menu) return;
    useAppStore.setState({ menu, menuLoading: false, menuError: false, menuLanguage });
  })();
}
