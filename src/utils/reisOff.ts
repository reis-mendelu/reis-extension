/**
 * Opening the real IS from reIS.
 *
 * In the extension the content script injects reIS on IS's home page
 * (`/auth/`, `/auth/index.pl`). A link to that page therefore reopens reIS: an
 * IS outage notice has no link of its own, so "Otevřít v IS" sent the student
 * straight back to the app they were trying to leave.
 *
 * A link that must show IS itself carries `#reis-off`. The content script
 * checks `isReisOff(location.hash)` first and then does nothing on that page
 * load. A URL fragment, not a query flag: it never reaches IS, so there is no
 * parameter for IS to reject, and it changes nothing on the phone, where no
 * content script runs.
 *
 * This file imports nothing: the content script loads it.
 */

export const REIS_OFF_HASH = '#reis-off';

const IS_HOST = 'is.mendelu.cz';

/** The pages the content script injects reIS on — and no other. */
export function isDashboardPath(pathname: string): boolean {
  return pathname === '/auth/' || pathname === '/auth/index.pl';
}

export function isReisOff(hash: string): boolean {
  return hash === REIS_OFF_HASH;
}

/**
 * `url`, made to open IS itself when it would otherwise reopen reIS. Any other
 * link, or one that already has a fragment, comes back unchanged.
 */
export function openInRealIs(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.hostname !== IS_HOST) return url;
    if (!isDashboardPath(u.pathname) || u.hash) return url;
    u.hash = REIS_OFF_HASH;
    return u.href;
  } catch {
    return url;
  }
}
