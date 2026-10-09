import { describe, expect, it, vi } from 'vitest';
import { CALENDAR_MARKER, createCalendarApi } from '../calendarApi';
import { AuthRevokedError, CalendarGoneError } from '../calendarHttp';
import type { DesiredEvent } from '../types';

type R = { status: number; body?: unknown } | 'network';
function fakeFetch(responses: R[]) {
  const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string> | undefined;
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body as string | undefined,
      auth: headers?.Authorization,
    });
    const r = responses.shift() ?? { status: 500 };
    if (r === 'network') throw new TypeError('Failed to fetch');
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  });
  return { f: f as unknown as typeof fetch, calls };
}
const api = (responses: R[], invalidate = vi.fn(async () => {}), tokens = ['T']) => {
  const { f, calls } = fakeFetch(responses);
  const sleep = vi.fn(async (_ms: number) => {});
  let t = 0;
  return {
    calls,
    invalidate,
    sleep,
    a: createCalendarApi({
      token: async () => tokens[Math.min(t, tokens.length - 1)]!,
      invalidateToken: async () => {
        t++;
        await invalidate();
      },
      fetch: f,
      sleep,
    }),
  };
};
const d = {
  id: 'lx',
  kind: 'lesson',
  date: '2026-10-09',
  hash: 'h',
  body: { id: 'lx', summary: 's' },
} as unknown as DesiredEvent;

describe('calendarApi', () => {
  it('finds the reIS calendar by its description marker', async () => {
    const { a } = api([
      {
        status: 200,
        body: {
          items: [
            { id: 'other', description: 'x', accessRole: 'owner' },
            { id: 'mine', description: `Rozvrh ${CALENDAR_MARKER}`, accessRole: 'owner' },
          ],
        },
      },
    ]);
    expect(await a.findReisCalendar()).toBe('mine');
  });
  it('treats an unticked calendar list (403 insufficient scopes) as not found', async () => {
    const { a } = api([
      {
        status: 403,
        body: {
          error: { status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] },
        },
      },
    ]);
    expect(await a.findReisCalendar()).toBeNull();
  });
  it('insert reports an id that already exists (409) instead of overwriting it', async () => {
    const { a, calls } = api([{ status: 409 }]);
    expect(await a.insert('cal', d)).toBe('exists');
    expect(calls.map((c) => c.method)).toEqual(['POST']);
  });
  it('insert reports a fresh event as inserted', async () => {
    const { a } = api([{ status: 200, body: {} }]);
    expect(await a.insert('cal', d)).toBe('inserted');
  });
  it('put restores with status confirmed', async () => {
    const { a, calls } = api([{ status: 200, body: {} }]);
    await a.put('cal', d);
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({ status: 'confirmed' });
    expect(calls[0]!.url).toContain('/calendars/cal/events/lx');
  });
  it('getEvent tells a deleted event from a live one, with its hash', async () => {
    const { a } = api([
      { status: 200, body: { id: 'lx', status: 'cancelled' } },
      {
        status: 200,
        body: {
          id: 'lx',
          status: 'confirmed',
          extendedProperties: { private: { reisHash: 'h1' } },
        },
      },
      { status: 404 },
    ]);
    expect(await a.getEvent('cal', 'lx')).toEqual({ cancelled: true, hash: '' });
    expect(await a.getEvent('cal', 'lx')).toEqual({ cancelled: false, hash: 'h1' });
    expect(await a.getEvent('cal', 'lx')).toEqual({ cancelled: true, hash: '' });
  });
  it('assertCalendar throws CalendarGoneError on 404', async () => {
    const { a } = api([{ status: 404 }]);
    await expect(a.assertCalendar('cal')).rejects.toBeInstanceOf(CalendarGoneError);
  });
  it('retries once after a 401 with a fresh token, then reports revoked', async () => {
    const { a, invalidate, calls } = api([{ status: 401 }, { status: 401 }], undefined, [
      'T1',
      'T2',
    ]);
    await expect(a.assertCalendar('cal')).rejects.toBeInstanceOf(AuthRevokedError);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.auth)).toEqual(['Bearer T1', 'Bearer T2']);
  });
  it('retries a dropped connection and a 5xx, backing off, then succeeds', async () => {
    const { a, calls, sleep } = api(['network', { status: 503 }, { status: 200, body: {} }]);
    await a.put('cal', d);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([150, 1000, 150, 2000, 150]);
  });
  it('gives up on a 5xx that persists', async () => {
    const { a, calls } = api(Array.from({ length: 10 }, () => ({ status: 503 })));
    await expect(a.put('cal', d)).rejects.toThrow('HTTP 503');
    expect(calls).toHaveLength(6);
  });
  it('gives up on a connection that stays down', async () => {
    const { a } = api(Array.from({ length: 10 }, (): R => 'network'));
    await expect(a.put('cal', d)).rejects.toThrow('Failed to fetch');
  });
  it('backs off on 429 and on 403 rateLimitExceeded', async () => {
    const { a, calls, sleep } = api([
      { status: 429 },
      { status: 403, body: { error: { errors: [{ reason: 'rateLimitExceeded' }] } } },
      { status: 200, body: {} },
    ]);
    await a.put('cal', d);
    expect(calls).toHaveLength(3);
    // 150 ms pace before every request; 1 s, then 2 s of backoff
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([150, 1000, 150, 2000, 150]);
  });
  it('lists one kind, paginated, from timeMin', async () => {
    const ev = (id: string) => ({
      id,
      start: { dateTime: '2026-10-09T09:00:00+02:00' },
      extendedProperties: { private: { reisKind: 'lesson', reisHash: 'h' } },
    });
    const { a, calls } = api([
      { status: 200, body: { items: [ev('l1')], nextPageToken: 'p2' } },
      { status: 200, body: { items: [ev('l2')] } },
    ]);
    const out = await a.listEvents('cal', 'lesson', '2026-10-08T00:00:00+02:00');
    expect(out).toEqual([
      { id: 'l1', kind: 'lesson', date: '2026-10-09', hash: 'h' },
      { id: 'l2', kind: 'lesson', date: '2026-10-09', hash: 'h' },
    ]);
    expect(calls[0]!.url).toContain('privateExtendedProperty=reisKind%3Dlesson');
    expect(calls[0]!.url).toContain('timeMin=');
    expect(calls[1]!.url).toContain('pageToken=p2');
  });
  it('treats 404 and 410 on delete as already gone', async () => {
    for (const status of [404, 410]) {
      const { a } = api([{ status }]);
      await expect(a.remove('cal', 'lx'), String(status)).resolves.toBeUndefined();
    }
  });
});
