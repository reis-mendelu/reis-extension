import { extractSessionToken, isPlausibleToken } from '../platform/sessionToken';

export interface ListenerHandle {
  remove(): Promise<void>;
}

export interface SessionDeps {
  getStored(): Promise<unknown>;
  save(token: string): Promise<void>;
  /** Presents the IS login WebView. Resolves once it has been presented. */
  openLogin(): Promise<void>;
  /** Fires on every page load inside that WebView. */
  onPageLoaded(cb: () => void): Promise<ListenerHandle>;
  readCookies(): Promise<Record<string, string>>;
  closeWebView(): Promise<void>;
}

/**
 * Guarantees a usable IS session token before the app boots.
 *
 * Both WebView engines drop `UISAuth` on app kill (measured), so a cold start
 * has no cookie even though the server-side session may still be alive. The
 * token is therefore persisted by us and replayed by the transport.
 *
 * Login completion is detected by *polling the cookie jar on each page load*
 * rather than by URL matching: IS's post-login destination varies (dashboard,
 * a "change your password" interstitial, a faculty picker), and matching URLs
 * would break on any of them. The cookie appearing is the actual signal.
 */
export async function ensureSession(deps: SessionDeps): Promise<string> {
  const stored = await deps.getStored();
  if (isPlausibleToken(stored)) return stored;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let handle: ListenerHandle | null = null;

    const finish = async (token: string) => {
      // Guard: page-load events keep arriving while we await below, and closing
      // or saving twice would be a real bug.
      if (settled) return;
      settled = true;
      try {
        await deps.save(token);
        await deps.closeWebView();
        await handle?.remove();
        resolve(token);
      } catch (e) {
        reject(e);
      }
    };

    const onLoad = () => {
      void (async () => {
        if (settled) return;
        const cookies = await deps.readCookies();
        const token = extractSessionToken(cookies);
        // Absent is the NORMAL case here — the login page itself fires a load
        // event before the student has typed anything. Keep waiting.
        if (isPlausibleToken(token)) await finish(token);
      })();
    };

    void (async () => {
      try {
        handle = await deps.onPageLoaded(onLoad);
        await deps.openLogin();
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e);
        }
      }
    })();
  });
}
