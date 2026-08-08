import { clearStoredToken } from '../platform/tokenStore';
import { clearUserParamsCache } from '../utils/userParams';
import { IndexedDBService } from '../services/storage';
import { logError } from '../utils/reportError';
import { IS_COOKIE_URL } from './inAppLoginDeps';

export interface SignOutDeps {
  /** Removes the replayed UISAuth credential from secure storage. */
  clearToken(): Promise<void>;
  /** Empties the WebView cookie jar for is.mendelu.cz. */
  clearIsCookies(): Promise<void>;
  clearUserParams(): void;
  clearLocalData(): Promise<void>;
  /** Sends the app back through boot, which presents the login. */
  restart(): void;
}

/**
 * Signing out of the app on a phone.
 *
 * The extension's sign-out is DOM-bound — the content script finds IS's own
 * logout FORM in the host page and submits it. The app has no host page, so
 * that mechanism does not exist here and `logout()` used to reject on
 * Capacitor: the button was in the settings sheet from day one and had never
 * once worked, only ever raising "sign-out is not available yet".
 *
 * What actually grants this device access is the stored UISAuth token, which
 * `capacitorTransport` replays into the native cookie jar on every request.
 * Removing it is therefore a real sign-out for this device, with no help
 * needed from IS.
 *
 * The cookies are the half that is easy to miss. The login WebView shares the
 * app's cookie jar, so leaving UISAuth in it means the next `ensureSession`
 * opens a login, IS answers with the dashboard because the cookie is still
 * good, the page-load poll reads it back, and the student is silently returned
 * to the same account without typing anything — a sign-out that visibly
 * un-does itself.
 *
 * The server-side session is deliberately NOT invalidated: IS's logout URL is
 * only ever discovered from its page chrome, and guessing an endpoint here
 * would be a parser-shaped bet with no sample to justify it. UISAuth reaches
 * IS from nowhere but this device, so clearing it locally is what protects the
 * student.
 */
export async function signOutMobile(deps: SignOutDeps): Promise<void> {
  // First, and allowed to throw: if the credential cannot be removed, the
  // sign-out has failed, and the destructive half below must not run. The
  // desktop path already refuses on exactly this reasoning — an emptied app
  // plus a device that can still act as the student is the worst outcome.
  await deps.clearToken();

  // Best-effort from here down. The credential is gone, so the sign-out has
  // already succeeded in the sense that matters, and no later failure may
  // strand the student in a half-signed-out app.
  try {
    await deps.clearIsCookies();
  } catch (e) {
    logError('Mobile.signOut:cookies', e);
  }

  try {
    deps.clearUserParams();
    await deps.clearLocalData();
  } catch (e) {
    logError('Mobile.signOut:localData', e);
  }

  deps.restart();
}

/**
 * The real bindings. The plugin import is lazy so the extension bundle never
 * pulls in `@capgo/capacitor-inappbrowser`.
 */
export function buildSignOutDeps(): SignOutDeps {
  return {
    clearToken: () => clearStoredToken(),
    clearIsCookies: async () => {
      const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
      await InAppBrowser.clearCookies({ url: IS_COOKIE_URL });
    },
    clearUserParams: () => clearUserParamsCache(),
    clearLocalData: () => IndexedDBService.clearAll(),
    // A reload rather than a hand-rolled teardown: boot() already owns the
    // "no token → present login" path, and re-running it is what guarantees
    // the signed-out app is in exactly the state a fresh install is.
    restart: () => window.location.reload(),
  };
}
