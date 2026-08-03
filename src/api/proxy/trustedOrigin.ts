export const PARENT_ORIGIN = 'https://is.mendelu.cz';

/**
 * Which origins may resolve a pending proxy request.
 *
 * In the extension the answer is only ever the IS page hosting the iframe.
 *
 * Capacitor has no parent page: the app IS the top-level window, and the
 * action loopback posts to itself, so replies arrive from the app's own origin
 * — `https://localhost` on Android, `capacitor://localhost` on iOS. Without
 * this allowance those replies are dropped and every action still times out
 * even with a responder in place.
 *
 * The allowance is narrow by construction. It is Capacitor-only, it matches the
 * app's *actual* origin rather than a hardcoded localhost pattern, and the
 * caller still checks `event.source === window.parent` — which on a top-level
 * window admits same-window posts only. An opaque `null` origin is never
 * trusted: a sandboxed frame can present one.
 */
export function isTrustedProxyOrigin(
  origin: string,
  platformKind: 'extension' | 'capacitor' | 'web',
  ownOrigin: string
): boolean {
  if (!origin || origin === 'null') return false;
  if (origin === PARENT_ORIGIN) return true;
  return platformKind === 'capacitor' && origin === ownOrigin;
}
