/**
 * A one-slot registry so the sync can report a lapsed session without knowing
 * who, if anyone, wants to hear about it.
 *
 * This exists for a measured reason. `injector/syncService` is the CONTENT
 * SCRIPT on the extension, and WXT bundles content scripts as a single file —
 * dynamic `import()` inside one is inlined, not split. Importing the Capacitor
 * recovery prompt from there, even lazily, pulled sonner, the login plugin, the
 * store and both locale files into a script injected on every IS page: 416 kB →
 * 966 kB, for code that can never run in that context.
 *
 * So the dependency is inverted. The sync depends only on this file; the
 * Capacitor bootstrap registers the handler. The extension registers nothing
 * and pays nothing.
 */

type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

/** Registered by the Capacitor bootstrap. Later calls replace the handler. */
export function setSessionExpiredHandler(fn: SessionExpiredHandler | null): void {
  handler = fn;
}

/**
 * Reports that a request came back unauthenticated. A no-op wherever no
 * handler is registered — on the extension the content script has already
 * navigated the host page to login.pl, so there is nothing to add.
 */
export function notifySessionExpired(): void {
  handler?.();
}
