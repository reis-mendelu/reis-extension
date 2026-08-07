import { getPlatform } from '../platform';
import { TOKEN_KEY } from '../platform/tokenStore';
import type { SessionDeps } from './ensureSession';

export const IS_LOGIN_URL = 'https://is.mendelu.cz/system/login.pl?lang=cz';
export const IS_COOKIE_URL = 'https://is.mendelu.cz/';

/**
 * The `SessionDeps` that drive the IS login WebView on Capacitor.
 *
 * Shared by boot (`main.capacitor.ts`) and by re-login after a session lapses,
 * because two copies of this would drift — and the cookie-polling contract in
 * ensureSession only holds if `onPageLoaded` and `readCookies` come from the
 * same WebView that `openLogin` presented.
 *
 * The plugin import is lazy so the extension bundle never pulls in
 * `@capgo/capacitor-inappbrowser`: this module is reachable from
 * `useFileActions`, which ships in both builds.
 */
export async function buildInAppLoginDeps(): Promise<SessionDeps> {
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  const storage = getPlatform().storage;

  return {
    getStored: () => storage.get(TOKEN_KEY),
    save: (token) => storage.set(TOKEN_KEY, token),
    openLogin: async () => {
      await InAppBrowser.openWebView({
        url: IS_LOGIN_URL,
        title: 'Přihlášení do UIS',
        isPresentAfterPageLoad: true,
      });
    },
    onPageLoaded: (cb) => InAppBrowser.addListener('browserPageLoaded', () => cb()),
    // Backing out of the login must reject rather than hang the caller.
    onDismissed: (cb) => InAppBrowser.addListener('closeEvent', () => cb()),
    readCookies: () =>
      InAppBrowser.getCookies({ url: IS_COOKIE_URL, includeHttpOnly: true }) as Promise<
        Record<string, string>
      >,
    closeWebView: async () => {
      await InAppBrowser.close();
    },
  };
}
