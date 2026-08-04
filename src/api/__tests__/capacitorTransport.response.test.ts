import { describe, it, expect, vi } from 'vitest';
import { fetchViaCapacitor } from '../capacitorTransport';
import { deps, TOKEN } from './capacitorDeps';

const IS = 'https://is.mendelu.cz/auth/';

/** What fetchViaCapacitor makes of what comes BACK. Request shaping is a sibling file. */
describe('fetchViaCapacitor response handling', () => {
  describe('status', () => {
    it('returns a Response carrying the body', async () => {
      const res = await fetchViaCapacitor(IS, TOKEN, deps());
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('logout.pl');
    });

    it('THROWS a sessionExpired error on a 403 — the measured silent-auth-failure case', async () => {
      const d = deps({
        httpGet: vi.fn(async () => ({ status: 403, data: 'denied', headers: {} })),
      });
      await expect(fetchViaCapacitor(IS, TOKEN, d)).rejects.toMatchObject({ sessionExpired: true });
    });

    it('applies the sessionExpired rule to a POST as well', async () => {
      const d = deps({ httpPost: vi.fn(async () => ({ status: 403, data: '' })) });
      await expect(
        fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'a=1' })
      ).rejects.toMatchObject({ sessionExpired: true });
    });

    it('does NOT call a 5xx a session expiry — an IS outage must not log the student out', async () => {
      const d = deps({
        httpGet: vi.fn(async () => ({ status: 503, data: 'maintenance', headers: {} })),
      });
      const err = await fetchViaCapacitor(IS, TOKEN, d).catch((e) => e);
      expect(err.message).toContain('503');
      expect(err.sessionExpired).toBeUndefined();
    });
  });

  describe('the logout.pl authentication gate', () => {
    it('THROWS on a 200 that is not authenticated — a wrong-cookie-mechanism bug looks exactly like this', async () => {
      const d = deps({
        httpGet: vi.fn(async () => ({
          status: 200,
          data: '<form action="/system/login.pl">',
          headers: {},
        })),
      });
      await expect(fetchViaCapacitor(IS, TOKEN, d)).rejects.toMatchObject({ sessionExpired: true });
    });

    it('still refuses an HTML body without a logout link, whatever the casing of its content-type', async () => {
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: '<form action="/system/login.pl">',
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        })),
      });
      await expect(
        fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'a=1' })
      ).rejects.toMatchObject({ sessionExpired: true });
    });

    it('accepts an HTML body that does carry the logout link', async () => {
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: '<a href="/system/logout.pl">out</a>',
          headers: { 'Content-Type': 'text/html' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'a=1' });
      expect(await res.text()).toContain('logout.pl');
    });

    // Regression: the gate is an HTML-ONLY auth signal. schedule.ts POSTs
    // rozvrhy_view.pl with `format: "json"` and IS answers with JSON, which can
    // never contain a logout link — applying the gate there rejected a perfectly
    // healthy response and fired a telemetry report every sync cycle, per language.
    it('passes a JSON POST response through instead of calling it a lapsed session', async () => {
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: '{"rozvrh":[]}',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'format=json' });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('{"rozvrh":[]}');
    });
  });

  describe('content-type', () => {
    it('carries the real content-type onto the Response — schedule.ts reads it to decide it got JSON', async () => {
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: '{"rozvrh":[]}',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'format=json' });
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    // iOS lowercases every response header key (lowerCaseHeaderDictionary) while
    // Android forwards the server's own casing, so an exact-cased lookup silently
    // reported JSON responses as text/html on whichever platform disagreed.
    it('reads the content-type case-insensitively, as the native layer returns it', async () => {
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: '{"rozvrh":[]}',
          headers: { 'content-type': 'application/json' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'format=json' });
      expect(res.headers.get('content-type')).toContain('application/json');
      expect(await res.text()).toBe('{"rozvrh":[]}');
    });

    // An empty content-type VALUE (as opposed to a missing header) must still
    // fall back to the HTML default. `?? 'text/html'` only substitutes on
    // undefined/null, so `contentType === ''` slipped the `includes('text/html')`
    // check and let an unauthenticated login page through as if it were data.
    it('treats an empty content-type header as HTML too, not as "no gate applies"', async () => {
      const d = deps({
        httpGet: vi.fn(async () => ({
          status: 200,
          data: '<form action="/system/login.pl">',
          headers: { 'content-type': '' },
        })),
      });
      await expect(fetchViaCapacitor(IS, TOKEN, d)).rejects.toMatchObject({ sessionExpired: true });
    });

    // A response with no content-type at all keeps the old assumption: IS's HTML
    // pages are the overwhelming majority of this path, and a login page arriving
    // header-less must still be caught.
    it('treats a content-type-less body as HTML, so a bare login page is still refused', async () => {
      const d = deps({
        httpGet: vi.fn(async () => ({ status: 200, data: '<form action="/system/login.pl">' })),
      });
      await expect(fetchViaCapacitor(IS, TOKEN, d)).rejects.toMatchObject({ sessionExpired: true });
    });
  });

  // Both native layers parse a JSON response body BEFORE it crosses the bridge
  // (Android's HttpRequestHandler.parseJSON, iOS's tryParseJson), so `res.data`
  // for a JSON response is already a parsed object, not a string. `String(obj)`
  // produces the literal text "[object Object]", which then fails JSON.parse
  // downstream — this is what broke fetchWeekSchedule on mobile.
  describe('body re-serialisation', () => {
    it('re-serialises a parsed-object POST response instead of stringifying it to "[object Object]"', async () => {
      const parsed = { rozvrh: [{ id: 1 }] };
      const d = deps({
        httpPost: vi.fn(async () => ({
          status: 200,
          data: parsed,
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d, { method: 'POST', body: 'format=json' });
      const text = await res.text();
      expect(text).not.toBe('[object Object]');
      expect(JSON.parse(text)).toEqual(parsed);
    });

    it('re-serialises a parsed-object GET response the same way', async () => {
      const parsed = { ok: true };
      const d = deps({
        httpGet: vi.fn(async () => ({
          status: 200,
          data: parsed,
          headers: { 'Content-Type': 'application/json' },
        })),
      });
      const res = await fetchViaCapacitor(IS, TOKEN, d);
      expect(await res.json()).toEqual(parsed);
    });
  });
});
