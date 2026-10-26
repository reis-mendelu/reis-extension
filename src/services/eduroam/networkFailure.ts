/**
 * Why an eduroam setup could not reach IS, when the reason is the network and
 * not IS. Setup needs internet to fetch the certificate — mobile data is fine,
 * Wi‑Fi is not required — so this is what the student has to hear instead of a
 * raw OS string.
 *
 * `offline`: the device says it has no connection at all.
 * `unreachable`: it thinks it is online, but the request never got an answer
 * (timeout, no route, DNS) — so the copy must hedge, not claim "offline".
 */
export type NetworkFailure = 'offline' | 'unreachable';

/**
 * What CapacitorHttp rejects with, by `code`. The message is the OS's
 * localizedDescription — Czech on a Czech phone — so the code is read instead.
 * iOS passes the NSError domain (HttpRequestHandler.swift), and every URLSession
 * failure is NSURLErrorDomain. Android passes the exception's class name
 * (CapacitorHttp.java); these are the ones that mean "no network". An SSL
 * failure is left out: it can be a captive portal, but it can as well be
 * something we should see raw.
 */
const NETWORK_CODES = new Set([
  'NSURLErrorDomain',
  'UnknownHostException',
  'ConnectException',
  'SocketTimeoutException',
  'NoRouteToHostException',
  'SocketException',
]);

/** A browser fetch's network rejection — Chromium, WebKit, Firefox. Not localized. */
const BROWSER_NETWORK_MESSAGE =
  /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/;

export function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function classifyNetworkFailure(
  e: unknown,
  online = !isDeviceOffline()
): NetworkFailure | null {
  if (!online) return 'offline';
  if (!(e instanceof Error)) return null;
  const code = (e as Error & { code?: unknown }).code;
  if (typeof code === 'string' && NETWORK_CODES.has(code)) return 'unreachable';
  return BROWSER_NETWORK_MESSAGE.test(e.message) ? 'unreachable' : null;
}
