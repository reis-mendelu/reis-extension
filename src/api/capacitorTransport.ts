import { UIS_AUTH_COOKIE } from '../platform/sessionToken';
import { notifySessionExpired } from '../services/sessionExpiry';
import {
  normalizeCapacitorBody,
  readHeader,
  type CapacitorRequestOptions,
} from './capacitorRequest';

export interface CookieDelivery {
  headers: Record<string, string>;
  seedNativeJar: boolean;
}

export interface CapacitorHttpResponse {
  status: number;
  data?: unknown;
  headers?: Record<string, string>;
}

export interface CapacitorTransportDeps {
  platform: 'ios' | 'android' | 'web';
  setCookie(o: { url: string; key: string; value: string }): Promise<void>;
  httpGet(o: { url: string; headers?: Record<string, string> }): Promise<CapacitorHttpResponse>;
  httpPost(o: {
    url: string;
    headers?: Record<string, string>;
    data?: string;
  }): Promise<CapacitorHttpResponse>;
}

/**
 * MEASURED on device (2026-08-02), and the two platforms are exact opposites:
 *
 *   Android — a hand-set `Cookie` header does NOT reach the server (403). The
 *             native layer manages cookies, so the jar must be seeded.
 *   iOS     — the reverse: the explicit header works, seeding the jar alone 403s.
 *
 * Do not "simplify" this into one branch, and do not do both at once — on
 * Android the explicit header actively produced a 403, so combining them is not
 * known to be safe.
 */
export function buildCookieDelivery(
  platform: 'ios' | 'android' | 'web',
  token: string
): CookieDelivery {
  if (platform === 'android') {
    return { headers: {}, seedNativeJar: true };
  }
  return { headers: { Cookie: `${UIS_AUTH_COOKIE}=${token}` }, seedNativeJar: false };
}

/**
 * IS answers an unauthenticated request with a normal 200 login page, so status
 * alone cannot tell us whether auth worked. A logout link is the signal — the
 * same one the device probes used.
 */
export function isAuthenticatedHtml(html: string): boolean {
  return /logout\.pl/.test(html);
}

/**
 * Mints the tagged auth error AND reports it.
 *
 * Reporting here rather than where the error is caught is the whole point:
 * almost every caller swallows a failure into `null` or `[]` (search, the GET
 * endpoints, each sync helper), and `syncAllData` wraps its fan-out in
 * `Promise.allSettled` — so a lapsed session reaches no catch block that could
 * tell the student. This is the one place every unauthenticated response
 * passes through.
 *
 * `notifySessionExpired` is a no-op wherever no handler is registered, which is
 * everywhere but the Capacitor app.
 */
function sessionExpired(message: string, failedToken?: string): Error {
  const err = new Error(message) as Error & { sessionExpired?: boolean };
  err.sessionExpired = true;
  // The token is forwarded, never logged: it lets the handler discard a
  // straggler from a session that has already been replaced.
  notifySessionExpired(failedToken);
  return err;
}

/** Kept local rather than imported from client.ts, which imports this module. */
const IS_ORIGIN = 'https://is.mendelu.cz';

/**
 * The native transports attach a live `UISAuth` to whatever URL they are given,
 * and some of those URLs come from parsed IS HTML rather than from our own code.
 * IS pages can link anywhere, so the destination is checked before the session
 * is attached: a session cookie must never leave the origin that issued it.
 *
 * Origin equality, not a suffix match — `is.mendelu.cz.evil.example` ends with
 * the IS domain and is not IS. A relative URL resolves against IS, so it passes;
 * a protocol-relative one (`//host/x`) does not, which is the point of resolving
 * rather than string-matching.
 */
export function assertIsOrigin(url: string): void {
  let origin: string;
  try {
    origin = new URL(url, IS_ORIGIN).origin;
  } catch {
    throw new Error('reIS: refusing to send the IS session to an unparseable URL');
  }
  if (origin !== IS_ORIGIN) {
    throw new Error(`reIS: refusing to send the IS session to ${origin}`);
  }
}

/**
 * The third transport behind fetchWithAuth. IS denies CORS to every origin
 * (`Access-Control-Allow-Origin: https://localhost.that.never.exists/`), so a
 * browser fetch from the app's own origin cannot reach it. CapacitorHttp runs
 * in the native layer, which is not subject to CORS.
 */
export async function fetchViaCapacitor(
  url: string,
  token: string,
  deps: CapacitorTransportDeps,
  options: CapacitorRequestOptions = {}
): Promise<Response> {
  assertIsOrigin(url);
  const delivery = buildCookieDelivery(deps.platform, token);

  if (delivery.seedNativeJar) {
    await deps.setCookie({
      url: 'https://is.mendelu.cz',
      key: UIS_AUTH_COOKIE,
      value: token,
    });
  }

  // Only GET and POST have a native transport. Anything else used to fall
  // through to httpGet with the body dropped, and the caller got a 200 for a
  // request that never happened — the silent-wrong-request shape this module
  // exists to eliminate, so it throws for the same reason an unrepresentable
  // body does.
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    throw new Error(`reIS: unsupported Capacitor request method: ${method}`);
  }
  const isPost = method === 'POST';

  // A POST body needs a Content-Type or IS will not parse it. GET must never
  // gain headers it didn't have before (~236 device-verified GETs on this
  // path), so the default is applied for POST only, and only when the caller
  // didn't already supply one — a caller-set Content-Type always wins.
  const contentTypeDefault: Record<string, string> =
    isPost && readHeader(options.headers, 'content-type') === undefined
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : {};

  // Cookie delivery goes LAST: on iOS the Cookie header IS the authentication,
  // so a caller must not be able to overwrite it and silently detach the
  // session. On Android that map is empty and the jar was seeded above.
  const headers = { ...contentTypeDefault, ...options.headers, ...delivery.headers };
  const res = isPost
    ? await deps.httpPost({ url, headers, data: normalizeCapacitorBody(options.body) })
    : await deps.httpGet({ url, headers });
  // Both native layers parse a JSON body BEFORE it crosses the bridge
  // (Android's HttpRequestHandler.parseJSON, iOS's tryParseJson fire ahead of
  // the responseType switch), so `res.data` for a JSON response is already a
  // parsed object, not a string. `String(obj)` produces the literal text
  // "[object Object]", which then fails JSON.parse downstream — this broke
  // fetchWeekSchedule on mobile (rozvrhy_view.pl POSTs `format: "json"`).
  // The `?? ''` must NOT sit inside the stringify: JSON.stringify('') is the
  // two-character text `""`, so an empty body would arrive as a non-empty one.
  const body =
    typeof res.data === 'string'
      ? res.data
      : res.data === undefined || res.data === null
        ? ''
        : JSON.stringify(res.data);

  if (res.status === 401 || res.status === 403) {
    throw sessionExpired(`HTTP ${res.status}`, token);
  }
  // Anything else non-2xx is IS being broken (5xx, a maintenance page), NOT the
  // student being logged out. Tagging it sessionExpired would throw them back to
  // a login screen over a transient outage — documentDownloader.ts keeps these
  // two cases apart for the same reason.
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  // A 200 that is not authenticated means either the session lapsed OR the
  // cookie was delivered the wrong way for this platform. Both are auth
  // failures; neither must be allowed to reach a parser as if it were data.
  //
  // The check is HTML-ONLY, because `logout.pl` is a property of IS's page
  // chrome and nothing else. schedule.ts POSTs rozvrhy_view.pl with
  // `format: "json"`; that JSON can never contain a logout link, so applying
  // the gate to it rejected healthy responses on every mobile sync cycle.
  // A response with no content-type keeps the old assumption — IS's HTML is
  // the overwhelming majority here, and a header-less login page must still be
  // caught.
  // `||`, not `??`: a header present with an empty string value must fall
  // back to the fail-closed HTML default too, not just a missing header.
  // `?? 'text/html'` only substitutes on undefined, so an empty content-type
  // slipped the `includes('text/html')` check below and let an
  // unauthenticated login page through as if it were data.
  const contentType = readHeader(res.headers, 'content-type') || 'text/html';
  if (contentType.toLowerCase().includes('text/html') && !isAuthenticatedHtml(body)) {
    throw sessionExpired('Authenticated request returned an unauthenticated page', token);
  }

  return new Response(body, {
    status: res.status,
    headers: new Headers({ 'Content-Type': contentType }),
  });
}
