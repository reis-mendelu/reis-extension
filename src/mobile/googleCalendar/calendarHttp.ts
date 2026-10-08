/**
 * Transport for the Calendar client: pacing, the one 401 retry with a fresh
 * token, and backoff on rate limits. Kept apart so calendarApi.ts reads as the
 * list of calls the sync makes.
 */
const BASE = 'https://www.googleapis.com/calendar/v3';
const PACE_MS = 200; // 5 req/s — Google's per-user quota counts batch parts too
const MAX_BACKOFF_TRIES = 5;

export class CalendarGoneError extends Error {}
export class AuthRevokedError extends Error {}
export class CalendarHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface CalendarApiDeps {
  token: () => Promise<string>;
  invalidateToken: () => Promise<void>;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
}

async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status === 429) return true;
  if (res.status !== 403) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
  const reason = body?.error?.errors?.[0]?.reason ?? '';
  return reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
}

export function ok(res: Response, what: string): Response {
  if (res.ok) return res;
  throw new CalendarHttpError(res.status, `${what} failed: HTTP ${res.status}`);
}

export function createRequest(deps: CalendarApiDeps) {
  return async function request(method: string, path: string, body?: unknown): Promise<Response> {
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      await deps.sleep(PACE_MS);
      const res = await deps.fetch(`${BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await deps.token()}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401) {
        if (refreshed) throw new AuthRevokedError('Google access was revoked');
        refreshed = true;
        await deps.invalidateToken();
        continue;
      }
      if ((await isRateLimited(res)) && attempt < MAX_BACKOFF_TRIES) {
        await deps.sleep(1000 * 2 ** attempt);
        continue;
      }
      return res;
    }
  };
}
