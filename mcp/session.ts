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

/**
 * IS answers a dead session with its login form, and not always as a redirect:
 * an invalid UISAuth got HTTP 403 with the form in the body (live, 2026-10-10).
 * So the status code is never trusted; the form is.
 */
async function isLoginPage(res: Response): Promise<boolean> {
  if (res.url.includes('/system/login.pl')) return true;
  if (!/text\/html/i.test(res.headers.get('content-type') ?? '')) return false;
  return /name="credential_1"/.test(await readHead(res.clone(), 20000));
}

/** The first `limit` bytes of a body, without buffering the rest of it. */
async function readHead(res: Response, limit: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return (await res.text()).slice(0, limit);
  const decoder = new TextDecoder();
  let text = '';
  while (text.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  // Not awaited: cancelling one branch of a cloned (tee'd) body settles only
  // once the other branch is cancelled too, so awaiting it hangs on any page
  // longer than `limit` (live, 2026-10-10).
  void reader.cancel().catch(() => {});
  return text.slice(0, limit);
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

  const recordFailure = (err: IsLoginError) => {
    lastFailure = { at: now(), error: err };
    if (err.kind !== 'unexpected' || ++unexpectedInARow >= MAX_UNEXPECTED) fatal = err;
  };

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
        recordFailure(err);
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
    let url: URL | null = null;
    try {
      url = new URL(urlOf(input));
    } catch {
      url = null;
    }
    if (url?.host !== IS_HOST) return nativeFetch(input, init);
    // The session cookie never travels in clear text.
    if (url.protocol !== 'https:') throw new Error('Refusing a non-HTTPS request to IS Mendelu.');

    const first = await send(input, init, cookie ?? (await login()));
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' || !(await isLoginPage(first))) return first;

    cookie = null;
    const retry = await send(input, init, await login());
    if (await isLoginPage(retry)) {
      // A fresh cookie that IS still rejects is a failed login: drop it and
      // ration the next attempt like any other failure.
      cookie = null;
      const err = new IsLoginError(
        'unexpected',
        'IS Mendelu keeps asking to sign in. Try again later.'
      );
      recordFailure(err);
      throw err;
    }
    return retry;
  };

  return { fetch: sessionFetch as typeof fetch };
}
