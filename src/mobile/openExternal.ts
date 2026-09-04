import { getPlatform } from '../platform';
import { UIS_AUTH_COOKIE } from '../platform/sessionToken';
import { logError } from '../utils/reportError';
import { DemoModeError, isDemoMode } from '../errors/demoMode';

/**
 * Opening external links without escaping to the system browser.
 *
 * On Capacitor a `target="_blank"` link — or a `window.open` — hands the URL to
 * the SYSTEM BROWSER, which has none of the app's IS session. The student taps
 * "Žádost na studijní oddělení" and lands on a login page instead of their
 * document. An IS link therefore stays in an in-app WebView that is given the
 * session two ways: a `Cookie` header on the first request, and the host app's
 * cookie store for every navigation after it.
 */

/** Only these reach a browser; mailto: and tel: belong to the platform. */
const OPENABLE_PROTOCOL = /^https?:$/;

/**
 * The one host whose pages need the session the app holds.
 *
 * Only this host is given the session, and only this host gets a WebView that
 * shares the app's own cookie store. Any third-party link gains nothing from
 * staying inside the app, is better off in the browser the student actually
 * uses, and must never be handed a view that can read an IS session.
 */
const NEEDS_APP_SESSION = /^is\.mendelu\.cz$/i;

/**
 * The origin the session cookie belongs to.
 *
 * The cookie is written against the ORIGIN, not the page URL: a cookie set for
 * `/auth/student/moje_studium.pl` would not be sent to the rest of IS, and the
 * whole point is that it survives wherever the student navigates next.
 */
const IS_COOKIE_ORIGIN = 'https://is.mendelu.cz';

export function needsAppSession(url: string): boolean {
  try {
    return NEEDS_APP_SESSION.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * The absolute http(s) URL to hand a browser, or null if this is not something
 * that may leave the app: a malformed URL, a non-http scheme, or one of the
 * app's own pages.
 *
 * Same-origin, not just "is it http": Capacitor serves the app from
 * http://localhost on Android, so a protocol check alone would happily hand the
 * app's OWN page to the in-app browser.
 */
export function validateExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    if (!OPENABLE_PROTOCOL.test(parsed.protocol)) return null;
    if (parsed.origin === window.location.origin) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * The URL a click should open externally, or null to leave the event alone.
 *
 * Split from the listener so the rules are testable without a plugin: which
 * clicks count is the part that gets this wrong, not the opening itself.
 */
export function externalHrefFromClick(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target as Element | null;
  // closest, not the target itself: every one of these links wraps an icon and
  // label, so the click always lands on a descendant.
  const anchor = target?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.getAttribute('aria-disabled') === 'true') return null;
  // An element that opens itself natively — the venue link hands its
  // coordinates to Apple Maps / the Android map chooser rather than to a
  // browser. This listener is installed in the CAPTURE phase, so it runs
  // BEFORE React's onClick: the component calling `preventDefault` cannot stop
  // it, because `defaultPrevented` is still false when we look. The venue
  // therefore opened twice, in Maps and in a browser tab. The opt-out has to
  // live on the element, which is the only thing both handlers can see.
  if (anchor.getAttribute('data-native-open') === 'true') return null;

  // getAttribute, not .href: the property resolves a missing href to the
  // current page, which would open the app in a browser window. DocsSheet
  // renders exactly that while the study id is still unresolved.
  const href = anchor.getAttribute('href');
  if (!href) return null;

  return validateExternalUrl(href);
}

/**
 * Opens a URL outside the app's own view.
 *
 * Off Capacitor this is the `window.open` every call site used to do inline.
 * The plugin import is lazy, so THIS module adds no plugin weight to a
 * non-Capacitor build.
 *
 * Scoped to this file on purpose. The older wording — "the extension bundle
 * never pulls in `@capgo/capacitor-inappbrowser`" — was false, and the same
 * false generalisation appeared in `saveDeps.ts`; see the note there for the
 * modules that do pull Capacitor runtime into the extension's main chunk.
 */
export async function openExternal(url: string): Promise<void> {
  // Same guard as fetchWithAuth, first statement so no request can escape:
  // this is the other chokepoint a reviewer's tap could reach MENDELU's real
  // login through.
  if (isDemoMode()) throw new DemoModeError();

  // Validated here, not only in externalHrefFromClick: StudentScreen and
  // NotificationsSheet call this directly, and a notification's `link` is
  // data from outside the app. Without this, a `javascript:` or app-scheme
  // URL would reach window.open or a native scheme handler untouched.
  const target = validateExternalUrl(url);
  if (!target) {
    logError('Mobile.openExternal', new Error('Refused to open a non-external URL'));
    return;
  }

  if (getPlatform().kind !== 'capacitor') {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');

    // Anything that does not need our session goes to the real browser —
    // Chrome Custom Tabs on Android, SFSafariViewController on iOS. Both carry
    // the student's own cookies, a visible URL bar, and pinch-to-zoom, which
    // the plain WebView withheld: a desktop IS page at 390px is unreadable
    // without it, and that was the complaint.
    if (!needsAppSession(target)) {
      await InAppBrowser.open({ url: target });
      return;
    }

    // The in-app WebView makes its OWN requests and sees none of the transport's
    // work, so it arrived at IS unauthenticated and the student was asked to
    // sign in again to read their own document.
    //
    // The cookie travels BOTH ways, and it has to.
    //
    // `headers` covers the one request the plugin builds
    // (WKWebViewController.createRequest) — that is the mechanism the native
    // transport already relies on for iOS (see buildCookieDelivery: on iOS the
    // header works and seeding the jar alone 403s). But it is only that one
    // request. Every link the student taps inside the page is a navigation the
    // plugin did not build, so it carries no header, and the first version of
    // this shipped exactly that: "IS cookies don't stay when I click on
    // external link (they show content but clicking on something shows
    // required login into IS - strange)". Authenticated page, login screen on
    // the next tap.
    //
    // So the cookie also goes into the jar, which is where a WebView looks on
    // every navigation. That needs `useSharedDataStore` below: on iOS 17+ capgo
    // gives its WebView an isolated `WKWebsiteDataStore(forIdentifier:)` (see
    // BrowsingDataStoreSupport) while `CapacitorCookies` writes to the HOST
    // app's store, so without the flag a seeded cookie lands in a jar this
    // WebView never reads — which is why an earlier attempt at this was
    // abandoned. The flag makes the store the same one.
    //
    // No token — a lapsed session — sends no header at all, deliberately: IS's
    // login page is then the honest destination, and throwing here would make
    // the tap look dead. loadStoredToken rejects rather than returning empty
    // when the keychain has nothing or cannot be read, which is the same
    // "is there one?" question buildInAppLoginDeps asks it.
    // https only, and checked here rather than trusted from the platform: the
    // app's cleartext-HTTP blocking lives in the iOS and Android configs, which
    // is the wrong place for this to depend on — a plugin default or an ATS
    // exception changed later would silently turn this line into the student's
    // session in cleartext. `validateExternalUrl` deliberately allows http for
    // ordinary links; only the credential-bearing branch requires https.
    const isSecure = new URL(target).protocol === 'https:';
    const { loadStoredToken } = await import('../platform/tokenStore');
    const token = isSecure ? await loadStoredToken().catch(() => '') : '';

    // Seeded only with a token in hand, and only for the IS branch — this line
    // is not reached for a third-party link, which goes to the system browser
    // above and must never be handed a view that can read this session.
    if (token) {
      const { CapacitorCookies } = await import('@capacitor/core');
      await CapacitorCookies.setCookie({
        url: IS_COOKIE_ORIGIN,
        key: UIS_AUTH_COOKIE,
        value: token,
      });
    }

    await InAppBrowser.openWebView({
      url: target,
      // The host, not a fixed string: the student should be able to see where
      // a link took them.
      title: new URL(target).hostname,
      isPresentAfterPageLoad: true,
      // IS's pages are built for a desktop; without this the WebView refuses
      // to zoom and half of them cannot be read on a phone. Android only —
      // iOS's WKWebView zooms by default.
      enableZoom: true,
      // Use the host app's store rather than the plugin's isolated one, so the
      // cookie seeded just above is visible to this WebView on EVERY
      // navigation, not just the request the plugin builds. A no-op on Android,
      // where cookies are already process-global via `CookieManager` — which is
      // why Android never showed this and an iPad did.
      //
      // Scoped to IS by where this sits: only the needsAppSession branch
      // reaches it.
      useSharedDataStore: true,
      ...(token ? { headers: { Cookie: `${UIS_AUTH_COOKIE}=${token}` } } : {}),
    });
  } catch (e) {
    // No toast: this runs from a document listener with no React context, so
    // there is no `t` to translate with. A plugin that fails to open is a
    // fault rather than a condition the student can act on, so telemetry is
    // the right destination — but it does mean the tap looks inert.
    logError('Mobile.openExternal', e);
  }
}

/**
 * Routes every `target="_blank"` link in the app through the in-app browser.
 *
 * A document-level interceptor rather than an edit per link, because a
 * hand-maintained list of these sites has already gone stale three times in
 * this plan — and this way the desktop tree is covered too, which matters if
 * the tablet path is ever supported.
 *
 * Capture phase so it runs before React's own handlers, and it deliberately
 * does NOT stopPropagation: a link inside a sheet may still need its onClick
 * to close it.
 *
 * Returns the uninstaller.
 */
export function installExternalLinkHandler(doc: Document = document): () => void {
  const onClick = (event: Event) => {
    const url = externalHrefFromClick(event as MouseEvent);
    if (!url) return;
    event.preventDefault();
    // Not `void`: openExternal rejects with DemoModeError in demo mode, and an
    // unhandled rejection is picked up by installErrorReporter's own
    // 'unhandledrejection' listener, which POSTs straight to Supabase without
    // passing through logError — so a deliberately blocked tap would be
    // transmitted as a crash report. Routing it through logError instead shows
    // the demo toast and reports nothing.
    void openExternal(url).catch((e) => logError('openExternal.click', e));
  };

  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}
