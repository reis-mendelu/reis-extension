/**
 * Hand a URL to the operating system, leaving the app's WebView where it is.
 *
 * A top-level navigation away from the app's own origin is cancelled by
 * Capacitor and passed on: iOS calls `UIApplication.shared.open`
 * (WebViewDelegationHandler), Android fires an `ACTION_VIEW` Intent
 * (Bridge.launchIntent). For an https link the OS then picks the app that owns
 * the domain — Instagram for instagram.com — or the default browser. Its own
 * module so tests can stand in for a navigation jsdom cannot perform.
 */
export function handToSystem(url: string): void {
  window.location.href = url;
}
