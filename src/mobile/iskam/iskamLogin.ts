import { LoginCancelledError, LoginUnreachableError, type ListenerHandle } from '../ensureSession';
import { jarGeneration, saveJar } from './iskamCookieStore';
import {
  IDP_COOKIE_URL,
  IDP_HOST,
  ISKAM_COOKIE_URL,
  ISKAM_HOST,
  ISKAM_ORIGIN,
  TICKET_COOKIE,
  jarFromRecord,
  type IskamJar,
} from './iskamJar';

export interface IskamLoginDeps {
  open(): Promise<void>;
  onPageLoaded(cb: () => void): Promise<ListenerHandle>;
  onDismissed(cb: () => void): Promise<ListenerHandle>;
  readCookies(): Promise<{ iskam: Record<string, string>; idp: Record<string, string> }>;
  /**
   * Writes the captured jar based on `basedOn`, the jar generation read before
   * the popup opened; false when a sign-out (or another login) landed since.
   */
  save(jar: IskamJar, basedOn: number): Promise<boolean>;
  generation(): number;
  /**
   * Drops webiskam's cookies from the WebView jar before the popup opens. The
   * popup only opens once the stored login is known dead, and the jar can
   * still hold that dead ticket: on Android it is shared with the app's native
   * HTTP, and WebISKAM never deletes an expired ticket, it only redirects. Left
   * there, the first page "found" it and the popup closed itself at once.
   * alibaba's cookies stay: they hold the student's attribute-release consent.
   */
  forgetIskamCookies(): Promise<void>;
  close(): Promise<void>;
  /** Tests only. */
  firstLoadTimeoutMs?: number;
}

/** As generous as the IS login, for the same reason: see ensureSession. */
const DEFAULT_FIRST_LOAD_TIMEOUT_MS = 30_000;

/**
 * The WebISKAM login popup, `ensureSession`'s contract for a different site.
 *
 * The student signs in on alibaba (MENDELU's IdP) inside the InAppBrowser.
 * Completion is the `.ISKAMASPXAUTH` cookie appearing on webiskam, polled on
 * every page load — not a URL match. Both jars are read then: webiskam's, and
 * alibaba's under /idp (path-scoped; the root URL returns none), because the
 * IdP session is what lets the silent chain log in again later without the
 * password. The password itself never passes through reIS.
 *
 * The first-load deadline is disarmed by the FIRST page load: from then on the
 * popup is on screen and the student may take as long as they like.
 */
export function signInToIskam(deps: IskamLoginDeps): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let loadHandle: ListenerHandle | null = null;
    let dismissHandle: ListenerHandle | null = null;

    const cleanup = async () => {
      clearTimeout(deadline);
      await loadHandle?.remove();
      await dismissHandle?.remove();
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      void cleanup();
      reject(e);
    };

    /** Every exit after the popup is up closes it: a stray one would block the next. */
    const finish = async (error?: unknown) => {
      try {
        await deps.close();
      } catch {
        // Best-effort: the outcome below matters more than the cleanup.
      }
      await cleanup();
      if (error === undefined) resolve();
      else reject(error);
    };

    const onLoad = () => {
      clearTimeout(deadline);
      void (async () => {
        if (settled) return;
        let cookies: { iskam: Record<string, string>; idp: Record<string, string> };
        try {
          cookies = await deps.readCookies();
        } catch (e) {
          if (settled) return;
          settled = true;
          await finish(e);
          return;
        }
        const { iskam, idp } = cookies;
        // Absent is the normal case: alibaba's own pages load before the ticket exists.
        if (!iskam[TICKET_COOKIE] || settled) return;
        settled = true;
        try {
          const saved = await deps.save(
            [...jarFromRecord(ISKAM_HOST, '/', iskam), ...jarFromRecord(IDP_HOST, '/idp', idp)],
            basedOn
          );
          // A sign-out landed while the student was typing: the app is on its
          // way out of this account, so the login is dropped, not resurrected.
          await finish(saved ? undefined : new LoginCancelledError());
        } catch (e) {
          await finish(e);
        }
      })();
    };

    const onDeadline = () => {
      if (settled) return;
      settled = true;
      void (async () => {
        try {
          await deps.close();
        } catch {
          // Best-effort: the student needs the error, not one about cleanup.
        }
        await cleanup();
        reject(new LoginUnreachableError());
      })();
    };

    // Armed before open(): openWebView resolves only on the first page load, so
    // during a stall the open call itself never settles.
    const deadline = setTimeout(
      onDeadline,
      deps.firstLoadTimeoutMs ?? DEFAULT_FIRST_LOAD_TIMEOUT_MS
    );

    const basedOn = deps.generation();
    void (async () => {
      try {
        loadHandle = await deps.onPageLoaded(onLoad);
        dismissHandle = await deps.onDismissed(() => fail(new LoginCancelledError()));
        await deps.forgetIskamCookies();
        // The deadline may have given up while setup was slow: no popup then,
        // or it would sit open behind an "unavailable" row.
        if (settled) {
          await cleanup();
          return;
        }
        await deps.open();
      } catch (e) {
        fail(e);
      }
    })();
  });
}

/** The real bindings. The plugin import is lazy: the extension must never load it. */
export async function buildIskamLoginDeps(): Promise<IskamLoginDeps> {
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  return {
    open: async () => {
      await InAppBrowser.openWebView({
        url: `${ISKAM_ORIGIN}/Prihlaseni/AuthShibb`,
        title: 'ISIC',
        isPresentAfterPageLoad: true,
        // NOT clearCookiesOnOpen: alibaba remembers the student's
        // attribute-release consent in a 1-year cookie, and clearing it would
        // show the 12-attribute consent screen on every login.
      });
    },
    onPageLoaded: (cb) => InAppBrowser.addListener('browserPageLoaded', () => cb()),
    onDismissed: (cb) => InAppBrowser.addListener('closeEvent', () => cb()),
    readCookies: async () => {
      const [iskam, idp] = await Promise.all([
        InAppBrowser.getCookies({ url: ISKAM_COOKIE_URL, includeHttpOnly: true }),
        InAppBrowser.getCookies({ url: IDP_COOKIE_URL, includeHttpOnly: true }),
      ]);
      return { iskam: iskam as Record<string, string>, idp: idp as Record<string, string> };
    },
    save: async (jar, basedOn) => (await saveJar(jar, basedOn)) !== null,
    generation: () => jarGeneration(),
    // Both jars, best-effort, as in signOut: CapacitorCookies reaches the
    // process-wide jar on Android with no dialog open, InAppBrowser its own
    // store on iOS 17+.
    forgetIskamCookies: async () => {
      const { CapacitorCookies } = await import('@capacitor/core');
      await Promise.allSettled([
        CapacitorCookies.clearCookies({ url: ISKAM_COOKIE_URL }),
        InAppBrowser.clearCookies({ url: ISKAM_COOKIE_URL }),
      ]);
    },
    close: async () => {
      await InAppBrowser.close();
    },
  };
}
