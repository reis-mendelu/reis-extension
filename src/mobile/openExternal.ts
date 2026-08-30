import { getPlatform } from '../platform';
import { logError } from '../utils/reportError';
import { DemoModeError, isDemoMode } from '../errors/demoMode';

/**
 * Opening external links without escaping to the system browser.
 *
 * On Capacitor a `target="_blank"` link — or a `window.open` — hands the URL to
 * the SYSTEM BROWSER, which has none of the app's IS session. The student taps
 * "Žádost na studijní oddělení" and lands on a login page instead of their
 * document. The in-app browser shares the native cookie jar the transport
 * already seeds, so the same link opens authenticated.
 */

/** Only these reach a browser; mailto: and tel: belong to the platform. */
const OPENABLE_PROTOCOL = /^https?:$/;

/**
 * The one host whose pages need the session the app holds.
 *
 * `capacitorTransport` replays the student's UISAuth into the app's own WebView
 * jar, and only the in-app view can see it. Any third-party link gains
 * nothing from staying inside the app and is better off in the browser the
 * student actually uses.
 */
const NEEDS_APP_SESSION = /^is\.mendelu\.cz$/i;

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
 * The plugin import is lazy so the extension bundle never pulls in
 * `@capgo/capacitor-inappbrowser`.
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
