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
  /** Drops the society/admin login, which supabase-js keeps outside IndexedDB. */
  clearAdminSession(): Promise<void>;
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
 * un-does itself. This module clears them best-effort; what guarantees it is
 * the login opening with `clearCookiesOnOpen` (see below for why).
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

  // Best-effort from here down: the credential is gone, so the sign-out has
  // already succeeded in the sense that matters, and nothing below may strand
  // the student in a half-signed-out app. The restart puts them at the login,
  // which gates the data anyway.
  //
  // The cookie used to be allowed to throw here, because a surviving UISAuth
  // answers the next login with the dashboard and signs the student straight
  // back in. But `InAppBrowser.clearCookies` only reaches an OPEN browser
  // dialog on Android (and iOS below 17), and none is open at sign-out, so it
  // rejected every time on those devices. The token was already gone, so the
  // throw refused nothing. It skipped the wipe, the society sign-out and the
  // restart, and showed an error over an app that was in fact signed out. The
  // guarantee now lives where the cookie does harm: the login opens with
  // `clearCookiesOnOpen` (mobile/inAppLoginDeps).
  try {
    await deps.clearIsCookies();
  } catch (e) {
    logError('Mobile.signOut:cookies', e);
  }

  // The society/admin login belongs after the token clear and not before it:
  // it is a second credential, kept by supabase-js outside
  // IndexedDB, and it has to go — but a sign-out this function REFUSES must
  // not have taken it. Signed in as the student and signed out of their
  // society console is exactly the half-torn-down state the refusal exists to
  // prevent.
  try {
    deps.clearUserParams();
    await deps.clearAdminSession();
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
    // Both jars, because each plugin reaches a different one: CapacitorCookies
    // works with no dialog open and covers the process-wide jar the transport
    // seeds on Android, and InAppBrowser covers its own store on iOS 17+.
    // Either one succeeding is a normal sign-out, not something to log.
    clearIsCookies: async () => {
      const [{ InAppBrowser }, { CapacitorCookies }] = await Promise.all([
        import('@capgo/capacitor-inappbrowser'),
        import('@capacitor/core'),
      ]);
      const results = await Promise.allSettled([
        InAppBrowser.clearCookies({ url: IS_COOKIE_URL }),
        CapacitorCookies.clearCookies({ url: IS_COOKIE_URL }),
      ]);
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length) throw failed[0].reason;
    },
    clearUserParams: () => clearUserParamsCache(),
    clearAdminSession: async () => {
      const { clearAdminSession } = await import('../services/admin/clearAdminSession');
      await clearAdminSession();
    },
    clearLocalData: () => IndexedDBService.clearAll(),
    // A reload rather than a hand-rolled teardown: boot() already owns the
    // "no token → present login" path, and re-running it is what guarantees
    // the signed-out app is in exactly the state a fresh install is.
    restart: () => window.location.reload(),
  };
}
