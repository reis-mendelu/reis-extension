/**
 * Browser name and major version, parsed from the user agent.
 *
 * Lives here rather than under `services/errorReporter/` because that whole
 * directory is gone: reIS transmits nothing about a failure. The one remaining
 * caller is the feedback form, where the browser is part of what the student is
 * telling us — a bug report without "which browser" is rarely actionable — and
 * it is disclosed in the privacy policy as such.
 */
export interface BrowserInfo {
  name: string;
  version: string;
}

export function getBrowserInfo(userAgent: string = navigator.userAgent): BrowserInfo {
  if (!userAgent) return { name: 'Unknown', version: '0' };
  // Order matters, twice over: the Edge UA also contains "Chrome", and BOTH
  // WebViews must be tested before the browser they are built on.
  //
  // The WebView branches are not cosmetic. `submit_suggestion` rate-limits on
  // `browser_name|browser_version`, so a whole platform collapsing to one pair
  // is a single 100-per-hour bucket shared by every user on it — and iOS did
  // exactly that: a WKWebView carries no `Version/` token (only Safari proper
  // does) and no `Chrome/`, so every report from the iPad landed as Unknown|0.
  // Proven in production, rows 8-9 of `suggestions`.
  let m: RegExpMatchArray | null;
  // safe: each regex has exactly one required capturing group
  if ((m = userAgent.match(/Edg\/(\d+)/))) return { name: 'Edge', version: m[1]! };
  if ((m = userAgent.match(/Firefox\/(\d+)/))) return { name: 'Firefox', version: m[1]! };
  // `wv` is the only thing separating Android's WebView from Chrome on the
  // same device, and the app and the browser deserve their own buckets.
  if (/\bwv\b/.test(userAgent) && (m = userAgent.match(/Chrome\/(\d+)/)))
    return { name: 'AndroidWebView', version: m[1]! };
  if ((m = userAgent.match(/Chrome\/(\d+)/))) return { name: 'Chrome', version: m[1]! };
  if ((m = userAgent.match(/Version\/(\d+).*Safari/))) return { name: 'Safari', version: m[1]! };
  // Chrome and Firefox on iOS, BEFORE the generic iOS branch. Both are WebKit
  // underneath and carry neither `Version/` nor `Chrome/`, so they fell through
  // to `CPU OS` and were labelled `iOS` — sharing the app's own rate-limit
  // bucket with two browsers that are not the app.
  if ((m = userAgent.match(/CriOS\/(\d+)/))) return { name: 'ChromeiOS', version: m[1]! };
  if ((m = userAgent.match(/FxiOS\/(\d+)/))) return { name: 'FirefoxiOS', version: m[1]! };
  // ...and only now the iOS WebView, so mobile Safari — which carries both
  // `Version/` and `Safari` — keeps reporting as the browser it is. The OS
  // version is the useful number here: WebKit's own build is the same across
  // an OS release, so it would separate nothing.
  if ((m = userAgent.match(/CPU (?:iPhone )?OS (\d+)/))) return { name: 'iOS', version: m[1]! };
  return { name: 'Unknown', version: '0' };
}
