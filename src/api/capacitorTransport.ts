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
