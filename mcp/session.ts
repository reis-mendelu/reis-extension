import { loginToIs, IsLoginError } from './login';

const IS_HOST = 'is.mendelu.cz';
/** No new login within this long of a failed one, whatever the failure. */
const LOGIN_FLOOR_MS = 60_000;
/** Unexplained login failures in a row before giving up until restart. */
const MAX_UNEXPECTED = 3;

export interface IsSession {
  /** Drop-in fetch: cookie to IS only, login on demand, one re-login on expiry. */
  fetch: typeof fetch;
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

/** IS serves its login page with HTTP 200 when a session has lapsed. */
async function isLoginPage(res: Response): Promise<boolean> {
  if (res.url.includes('/system/login.pl')) return true;
  if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) return false;
  const head = (await res.clone().text()).slice(0, 20000);
  return /name="credential_1"/.test(head);
}

/**
 * The cookie lives in this closure and the returned fetch is created once, so
 * a re-login can never be shadowed by an older wrapper (reis-scraper's
 * installNodeRuntime re-wrapped fetch, and the stale inner cookie won).
 *
 * Failed logins are rationed: credentials and 2FA failures are final, any
 * failure blocks the next attempt for a minute, and three unexplained ones in
 * a row are final. An IS answer we have not seen must never turn into one
 * failed login per tool call against the student's account.
 */
export function createIsSession(
  creds: { user: string; pass: string },
  nativeFetch: typeof fetch,
  now: () => number = Date.now
): IsSession {
  let cookie: string | null = null;
  let inflight: Promise<string> | null = null;
  let fatal: IsLoginError | null = null;
  let lastFailure: { at: number; error: IsLoginError } | null = null;
  let unexpectedInARow = 0;

  const login = (): Promise<string> => {
    if (fatal) return Promise.reject(fatal);
    if (lastFailure && now() - lastFailure.at < LOGIN_FLOOR_MS) {
      return Promise.reject(lastFailure.error);
    }
    inflight ??= loginToIs(creds.user, creds.pass, nativeFetch)
      .then((c) => {
        lastFailure = null;
        unexpectedInARow = 0;
        return (cookie = c);
      })
      .catch((e: unknown) => {
        const err =
          e instanceof IsLoginError
            ? e
            : new IsLoginError('unexpected', 'IS Mendelu did not start a session.');
        lastFailure = { at: now(), error: err };
        if (err.kind !== 'unexpected' || ++unexpectedInARow >= MAX_UNEXPECTED) fatal = err;
        throw err;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  // A plain header record, not Headers: in a browser-like runtime Headers
  // silently drops Cookie, and Node's fetch accepts either.
  const send = (input: RequestInfo | URL, init: RequestInit, c: string) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    headers.cookie = c;
    return nativeFetch(input, { ...init, headers });
  };

  const sessionFetch = async (
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> => {
    let host = '';
    try {
      host = new URL(urlOf(input)).host;
    } catch {
      host = '';
    }
    if (host !== IS_HOST) return nativeFetch(input, init);

    const first = await send(input, init, cookie ?? (await login()));
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' || !(await isLoginPage(first))) return first;

    cookie = null;
    const retry = await send(input, init, await login());
    if (await isLoginPage(retry)) {
      throw new IsLoginError('unexpected', 'IS Mendelu keeps asking to sign in. Try again later.');
    }
    return retry;
  };

  return { fetch: sessionFetch as typeof fetch };
}
