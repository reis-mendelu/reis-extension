import type { DesiredEvent, ExistingEvent, ReisKind } from './types';

export const CALENDAR_MARKER = 'reis:rozvrh:v1';
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

const enc = encodeURIComponent;

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

function ok(res: Response, what: string): Response {
  if (res.ok) return res;
  throw new CalendarHttpError(res.status, `${what} failed: HTTP ${res.status}`);
}

interface ListedEvent {
  id: string;
  start?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/**
 * The Google Calendar v3 calls the sync needs, and nothing else. Every request
 * is paced (5/s) and retried: once with a fresh token after a 401, and with
 * exponential backoff on 429 or a 403 rate limit.
 */
export function createCalendarApi(deps: CalendarApiDeps) {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
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
  }

  async function findReisCalendar(): Promise<string | null> {
    let page: string | undefined;
    do {
      const q = `/users/me/calendarList?minAccessRole=owner&fields=items(id,description),nextPageToken${page ? `&pageToken=${enc(page)}` : ''}`;
      const res = await request('GET', q);
      // Granular consent: the student unticked the calendar list. Not a rate limit
      // (those say rateLimitExceeded and are retried inside request), so create instead.
      if (res.status === 403 && /insufficient/i.test(await res.clone().text())) return null;
      const json = (await ok(res, 'calendarList').json()) as {
        items?: { id: string; description?: string }[];
        nextPageToken?: string;
      };
      const hit = json.items?.find((c) => c.description?.includes(CALENDAR_MARKER));
      if (hit) return hit.id;
      page = json.nextPageToken;
    } while (page);
    return null;
  }

  async function createCalendar(name: string): Promise<string> {
    const res = await request('POST', '/calendars', {
      summary: name,
      timeZone: 'Europe/Prague',
      description: `${name} · reIS · ${CALENDAR_MARKER}`,
    });
    return ((await ok(res, 'createCalendar').json()) as { id: string }).id;
  }

  async function assertCalendar(id: string): Promise<void> {
    const res = await request('GET', `/calendars/${enc(id)}?fields=id`);
    if (res.status === 404) throw new CalendarGoneError('Rozvrh was deleted in Google');
    ok(res, 'getCalendar');
  }

  async function listEvents(
    calendarId: string,
    kind: ReisKind,
    timeMin: string | null
  ): Promise<ExistingEvent[]> {
    const out: ExistingEvent[] = [];
    let page: string | undefined;
    do {
      const params = new URLSearchParams({
        privateExtendedProperty: `reisKind=${kind}`,
        maxResults: '2500',
        fields: 'items(id,start,extendedProperties),nextPageToken',
      });
      if (timeMin) params.set('timeMin', timeMin);
      if (page) params.set('pageToken', page);
      const res = await request('GET', `/calendars/${enc(calendarId)}/events?${params}`);
      const json = (await ok(res, 'listEvents').json()) as {
        items?: ListedEvent[];
        nextPageToken?: string;
      };
      for (const item of json.items ?? []) {
        const start = item.start?.dateTime ?? item.start?.date ?? '';
        out.push({
          id: item.id,
          kind,
          date: start.slice(0, 10),
          hash: item.extendedProperties?.private?.reisHash ?? '',
        });
      }
      page = json.nextPageToken;
    } while (page);
    return out;
  }

  async function put(calendarId: string, d: DesiredEvent): Promise<void> {
    const res = await request('PUT', `/calendars/${enc(calendarId)}/events/${enc(d.id)}`, {
      ...d.body,
      status: 'confirmed',
    });
    ok(res, 'putEvent');
  }

  async function upsert(calendarId: string, d: DesiredEvent): Promise<void> {
    const res = await request('POST', `/calendars/${enc(calendarId)}/events`, d.body);
    // Google keeps a deleted event's id reserved; PUT with status confirmed restores it.
    if (res.status === 409) return put(calendarId, d);
    ok(res, 'insertEvent');
  }

  async function remove(calendarId: string, id: string): Promise<void> {
    const res = await request('DELETE', `/calendars/${enc(calendarId)}/events/${enc(id)}`);
    if (res.status === 404 || res.status === 410) return;
    ok(res, 'deleteEvent');
  }

  return { findReisCalendar, createCalendar, assertCalendar, listEvents, upsert, put, remove };
}

export type CalendarApi = ReturnType<typeof createCalendarApi>;
