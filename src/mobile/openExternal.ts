import { getPlatform } from '../platform';
import { logError } from '../utils/reportError';

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

  try {
    const url = new URL(href, window.location.href);
    if (!OPENABLE_PROTOCOL.test(url.protocol)) return null;
    // Same-origin, not just "is it http": Capacitor serves the app from
    // http://localhost on Android, so a protocol check alone would happily
    // hand the app's OWN page to the in-app browser. Comparing origins is the
    // rule that actually holds on every platform.
    if (url.origin === window.location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Opens a URL outside the app's own view.
 *
 * Off Capacitor this is the `window.open` every call site used to do inline.
 * The plugin import is lazy so the extension bundle never pulls in
 * `@capgo/capacitor-inappbrowser`.
 */
export async function openExternal(url: string): Promise<void> {
  if (getPlatform().kind !== 'capacitor') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
    await InAppBrowser.openWebView({
      url,
      // The host, not a fixed string: these links span IS, WebISKAM and the
      // occasional third party, and the student should be able to see which.
      title: new URL(url).hostname,
      isPresentAfterPageLoad: true,
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
    void openExternal(url);
  };

  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}
