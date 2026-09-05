import canteenMenu from './fixtures/canteenMenu.json';
import { rebaseMenuFixture } from './menuFixture';
import { useAppStore } from '../src/store/useAppStore';

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
 * DEV-gated and in `dev/`, so it cannot reach the extension or the Capacitor
 * bundle.
 */
if (import.meta.env.DEV) {
  const menu = rebaseMenuFixture(canteenMenu, new Date());
  if (menu.length && !useAppStore.getState().menu) {
    useAppStore.setState({ menu, menuLoading: false, menuError: false });
  }
}
