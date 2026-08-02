/**
 * The IS session is exactly one cookie. Verified against live IS: `UISAuth`,
 * domain is.mendelu.cz, path /, no Expires (session cookie), HttpOnly, Secure,
 * SameSite=Lax — and name+value+domain+path alone is enough to authenticate.
 *
 * Both WKWebView and Android WebView drop it on app kill, so it must be
 * captured and replayed. This module is the pure half: no storage, no plugin.
 */
export const UIS_AUTH_COOKIE = 'UISAuth';

/** Shorter than this and it is a truncation bug, not a token. */
const MIN_TOKEN_LENGTH = 16;

export function extractSessionToken(cookies: Record<string, string>): string | null {
  const raw = cookies[UIS_AUTH_COOKIE];
  return raw ? raw : null;
}

export function isPlausibleToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_TOKEN_LENGTH;
}

export function buildRestoreHeaders(token: string): Record<string, string> {
  return { Cookie: `${UIS_AUTH_COOKIE}=${token}` };
}

/**
 * Runs at documentStart. Deliberately sets NO `expires`, so the restored cookie
 * is a session cookie exactly like the one IS issues.
 *
 * This is only half the restore: the first request leaves before any script can
 * run, so it is authenticated by the Cookie *header* instead. This script seeds
 * the jar so every subsequent navigation carries the cookie too. Header alone
 * loses auth on the first navigation; this alone cannot authenticate request #1.
 */
export function buildRestoreScript(token: string): string {
  return `(function(){try{document.cookie=${JSON.stringify(UIS_AUTH_COOKIE)}+"="+${JSON.stringify(
    token,
  )}+"; path=/; secure";}catch(e){}})();`;
}
