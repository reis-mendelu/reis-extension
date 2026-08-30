/**
 * Origins allowed to postMessage into the iframe app.
 *
 * The app runs at a chrome-extension:// origin inside a page it does not
 * control, so `window.addEventListener('message')` is reachable by any frame
 * on that page — not just our own content script. Every handler must check
 * both that the sender is the parent window and that the parent's origin is
 * one of these, or a hostile frame can drive the UI by posting our own
 * message shapes at us.
 */
const TRUSTED_HOST_ORIGINS = ['https://is.mendelu.cz'];

/** Extension pages (the app posting to itself) — Chrome and Firefox schemes. */
const EXTENSION_SCHEMES = ['chrome-extension://', 'moz-extension://'];

/**
 * Exact-match, never prefix-match. `startsWith('https://is.mendelu.cz')` would
 * accept `https://is.mendelu.cz.evil.example`, and the same trap applies to
 * the localhost harness.
 */
export function isTrustedHostOrigin(origin: string, isDev: boolean): boolean {
  if (TRUSTED_HOST_ORIGINS.includes(origin)) return true;
  if (EXTENSION_SCHEMES.some((scheme) => origin.startsWith(scheme))) return true;
  // The dev webapp harness (npm run dev:web) runs the app as a plain page on
  // a port the harness may reassign, so the port is not pinned — but this is
  // gated on a build-time DEV flag and cannot reach a production bundle.
  if (isDev && /^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}
