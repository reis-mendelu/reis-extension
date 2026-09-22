import { extractSessionToken, isPlausibleToken } from '../platform/sessionToken';

/**
 * The student dismissed the login WebView rather than failing to sign in.
 *
 * A distinct type rather than a message match: boot branches on this to show
 * the sign-in gate instead of an error, and the message is user-facing copy
 * that will be reworded.
 */
export class LoginCancelledError extends Error {
  constructor() {
    super('Login cancelled: the sign-in window was dismissed');
    this.name = 'LoginCancelledError';
  }
}

/**
 * The login page never loaded, so the WebView was never presented.
 *
 * Distinct from `LoginCancelledError` because nobody chose this: the student
 * saw no WebView at all. Boot therefore routes it to the error screen — which
 * carries a retry and says something went wrong — rather than to the sign-in
 * gate, whose copy assumes they backed out on purpose.
 */
export class LoginUnreachableError extends Error {
  constructor() {
    super('Login unreachable: the IS sign-in page did not load');
    this.name = 'LoginUnreachableError';
  }
}

/**
 * How long the IS login page gets to produce its first load event.
 *
 * A deadline on the FIRST load, not on the login: once that event arrives the
 * WebView is on screen — the same `onPageFinished` that fires it is what
 * presents the dialog — and the student may then take as long as they like to
 * type. Nothing here can interrupt a login in progress.
 *
 * 30 s rather than the 8 s `verifySession` allows its probe: that one races a
 * request whose fallback is "keep the token and carry on", while this is the
 * student's only route into the app, so it should be generous. It is still
 * bounded, because the thing it is measured against is not "wait a little
 * longer" — it is the splash screen, forever.
 */
const DEFAULT_FIRST_LOAD_TIMEOUT_MS = 30_000;

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
  /**
   * Overrides `DEFAULT_FIRST_LOAD_TIMEOUT_MS`. Tests only — no caller sets it,
   * and the default is what ships.
   */
  firstLoadTimeoutMs?: number;
  /**
   * Fires when the WebView closes. Optional, because not every host can report
   * it — but where it exists it is the only way to learn that the student
   * backed out, and without it this never settles.
   */
  onDismissed?(cb: () => void): Promise<ListenerHandle>;
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
    let dismissHandle: ListenerHandle | null = null;
    let deadline: ReturnType<typeof setTimeout> | undefined;

    const cleanup = async () => {
      clearTimeout(deadline);
      await handle?.remove();
      await dismissHandle?.remove();
    };

    const finish = async (token: string) => {
      // Guard: page-load events keep arriving while we await below, and closing
      // or saving twice would be a real bug.
      if (settled) return;
      settled = true;
      try {
        await deps.save(token);
        await deps.closeWebView();
        await cleanup();
        resolve(token);
      } catch (e) {
        reject(e);
      }
    };

    /**
     * The student backed out of the login. Rejecting is the whole point:
     * boot() awaits this before hiding the splash screen, so staying pending
     * strands them on the splash with no error and no way to retry.
     *
     * Ordering matters — our own closeWebView() in finish() fires this same
     * event, which is why `settled` is checked first.
     */
    const onDismiss = () => {
      if (settled) return;
      settled = true;
      void cleanup();
      reject(new LoginCancelledError());
    };

    const onLoad = () => {
      // Disarm on the FIRST load event, whether or not it carried a token —
      // and the "whether or not" is the whole point. This event and the
      // presentation of the dialog are the same `onPageFinished`, so its
      // arrival proves the WebView is on screen, which is all the deadline
      // was ever asking about. Waiting for a token instead would put a 30 s
      // limit on how long the student may take to type their password, and
      // then close the WebView in front of them mid-login.
      clearTimeout(deadline);
      void (async () => {
        if (settled) return;
        const cookies = await deps.readCookies();
        const token = extractSessionToken(cookies);
        // Absent is the NORMAL case here — the login page itself fires a load
        // event before the student has typed anything. Keep waiting.
        if (isPlausibleToken(token)) await finish(token);
      })();
    };

    /**
     * Nothing loaded, and nothing ever will.
     *
     * A page load that STALLS — the connection accepted and then answered by
     * nobody, which is a captive portal holding 443, an IPv6 blackhole, a
     * router dropping oversized packets — fires neither `onPageFinished` nor
     * `onReceivedError` in the WebView for minutes. `openWebView` is called
     * with `isPresentAfterPageLoad`, and the plugin presents its dialog from
     * exactly one place: `onPageFinished`. So there is nothing on screen and
     * nothing to dismiss, and every `closeEvent` the plugin can emit requires
     * a presented dialog — the student cannot back out of a WebView they
     * cannot see.
     *
     * Without this, none of the three ways out could fire and the promise
     * never settled. boot() awaits it before `SplashScreen.hide()` under
     * `launchAutoHide: false`, so that was the splash screen forever, with no
     * login and no error: the same dead end the dismissal case above exists
     * to prevent, reached by a different road.
     */
    const onDeadline = () => {
      if (settled) return;
      settled = true;
      void (async () => {
        try {
          // The dialog is hidden but alive, and the plugin holds one at a
          // time — left behind, it is what the next attempt would collide
          // with. Best-effort only: this path is already a failure, and the
          // student needs the error, not a second one about the cleanup.
          await deps.closeWebView();
        } catch {
          // Intentionally ignored — see above.
        }
        await cleanup();
        reject(new LoginUnreachableError());
      })();
    };

    // Armed HERE, before the await below, and that placement is the fix.
    // `openLogin` is `await InAppBrowser.openWebView(...)`, whose plugin call
    // resolves only in `onPageFinished` and rejects only in
    // `onReceivedError` — so during a stall THE OPEN CALL ITSELF never
    // settles. A deadline armed after it would never be armed at all.
    deadline = setTimeout(onDeadline, deps.firstLoadTimeoutMs ?? DEFAULT_FIRST_LOAD_TIMEOUT_MS);

    void (async () => {
      try {
        handle = await deps.onPageLoaded(onLoad);
        dismissHandle = (await deps.onDismissed?.(onDismiss)) ?? null;
        await deps.openLogin();
      } catch (e) {
        if (!settled) {
          settled = true;
          // Also drops the deadline, which would otherwise outlive this
          // rejection as a stray timer holding the event loop open.
          void cleanup();
          reject(e);
        }
      }
    })();
  });
}
