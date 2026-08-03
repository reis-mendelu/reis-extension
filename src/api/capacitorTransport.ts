import { UIS_AUTH_COOKIE } from '../platform/sessionToken';

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

function sessionExpired(message: string): Error {
  const err = new Error(message) as Error & { sessionExpired?: boolean };
  err.sessionExpired = true;
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
  deps: CapacitorTransportDeps
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

  const res = await deps.httpGet({ url, headers: delivery.headers });
  const body = String(res.data ?? '');

  if (res.status === 401 || res.status === 403) {
    throw sessionExpired(`HTTP ${res.status}`);
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
  if (!isAuthenticatedHtml(body)) {
    throw sessionExpired('Authenticated request returned an unauthenticated page');
  }

  return new Response(body, {
    status: res.status,
    headers: new Headers({
      'Content-Type': res.headers?.['Content-Type'] ?? 'text/html',
    }),
  });
}
