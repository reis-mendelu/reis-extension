import { loadStoredToken, saveStoredToken } from '../platform/tokenStore';
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
  return {
    // Through tokenStore, never platform.storage: the login flow is what WRITES
    // the credential, so a raw storage.set here would put a live UISAuth into
    // plaintext Preferences no matter how the read side is secured.
    // loadStoredToken throws on a missing/unreadable token; ensureSession wants
    // "is there one?", so the throw becomes undefined and it presents login.
    getStored: () => loadStoredToken().catch(() => undefined),
    save: (token) => saveStoredToken(token),
    openLogin: async () => {
      await InAppBrowser.openWebView({
        url: IS_LOGIN_URL,
        title: 'Přihlášení do UIS',
        isPresentAfterPageLoad: true,
      });
      // openWebView resolves in onPageFinished, the same event that presents
      // the dialog — so the login is on screen now, which is all the splash
      // was waiting to know. Android before 12 keeps every window of the app
      // hidden until the activity's own window draws, and the compat splash
      // (launchAutoHide: false) blocks that draw until hide(). Leaving the
      // hide to boot(), after login, kept the login itself invisible: Android
      // 10/11 sat on the splash forever. iOS presents the modal above the
      // splash, so it keeps boot()'s hide and the no-empty-frame guarantee.
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.getPlatform() === 'android') {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      }
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
