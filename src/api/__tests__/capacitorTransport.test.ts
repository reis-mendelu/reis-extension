import { describe, it, expect, vi } from 'vitest';
import {
  buildCookieDelivery,
  isAuthenticatedHtml,
  fetchViaCapacitor,
  assertIsOrigin,
  type CapacitorTransportDeps,
} from '../capacitorTransport';
import { normalizeCapacitorBody } from '../capacitorRequest';

const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';

describe('buildCookieDelivery', () => {
  // MEASURED on device: Android ignores a hand-set Cookie header (403) and
  // needs the native jar; iOS is the exact inverse. Do not "simplify" this.
  it('uses the native jar on android, with no Cookie header', () => {
    expect(buildCookieDelivery('android', TOKEN)).toEqual({
      headers: {},
      seedNativeJar: true,
    });
  });

  it('uses an explicit Cookie header on ios, without seeding the jar', () => {
    expect(buildCookieDelivery('ios', TOKEN)).toEqual({
      headers: { Cookie: `UISAuth=${TOKEN}` },
      seedNativeJar: false,
    });
  });

  it('falls back to the header form on web', () => {
    expect(buildCookieDelivery('web', TOKEN).seedNativeJar).toBe(false);
  });
});

describe('isAuthenticatedHtml', () => {
  it('treats a logout link as proof of authentication', () => {
    expect(isAuthenticatedHtml('<a href="/system/logout.pl">Log out</a>')).toBe(true);
  });

  it('treats a page without one as unauthenticated', () => {
    expect(isAuthenticatedHtml('<form action="/system/login.pl">')).toBe(false);
  });
});

describe('fetchViaCapacitor', () => {
  function deps(over: Partial<CapacitorTransportDeps> = {}): CapacitorTransportDeps {
    return {
      platform: 'android',
      setCookie: vi.fn(async () => {}),
      httpGet: vi.fn(async () => ({
        status: 200,
        data: '<a href="/system/logout.pl">x</a>',
        headers: { 'Content-Type': 'text/html' },
      })),
      httpPost: vi.fn(async () => ({
        status: 200,
        data: '<a href="/system/logout.pl">x</a>',
        headers: { 'Content-Type': 'text/html' },
      })),
      ...over,
    };
  }

  it('seeds the native jar on android before requesting', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.setCookie).toHaveBeenCalledWith({
      url: 'https://is.mendelu.cz',
      key: 'UISAuth',
      value: TOKEN,
    });
  });

  it('does NOT seed the jar on ios', async () => {
    const d = deps({ platform: 'ios' });
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.setCookie).not.toHaveBeenCalled();
  });

  it('returns a Response carrying the body', async () => {
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, deps());
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('logout.pl');
  });

  it('THROWS a sessionExpired error on a 403 — the measured silent-auth-failure case', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({ status: 403, data: 'denied', headers: {} })),
    });
    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it('THROWS on a 200 that is not authenticated — a wrong-cookie-mechanism bug looks exactly like this', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: '<form action="/system/login.pl">',
        headers: {},
      })),
    });
    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  it('does NOT call a 5xx a session expiry — an IS outage must not log the student out', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({ status: 503, data: 'maintenance', headers: {} })),
    });
    const err = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d).catch((e) => e);
    expect(err.message).toContain('503');
    expect(err.sessionExpired).toBeUndefined();
  });

  it('refuses to send the session to a non-IS origin, and never requests it', async () => {
    const d = deps();
    await expect(fetchViaCapacitor('https://evil.example/steal', TOKEN, d)).rejects.toThrow(
      /evil\.example/
    );
    expect(d.httpGet).not.toHaveBeenCalled();
    expect(d.setCookie).not.toHaveBeenCalled();
  });

  it('refuses a lookalike host that merely ends with the IS domain', async () => {
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz.evil.example/x', TOKEN, deps())
    ).rejects.toThrow(/refusing/i);
  });

  it('accepts a relative URL, which can only resolve to IS', async () => {
    const d = deps();
    await expect(fetchViaCapacitor('/auth/student/', TOKEN, d)).resolves.toBeInstanceOf(Response);
  });

  it('sends a POST through httpPost with the body as data', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/wifi/certifikat.pl', TOKEN, d, {
      method: 'POST',
      body: 'lang=cz&gen=x',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    expect(d.httpPost).toHaveBeenCalledWith({
      url: 'https://is.mendelu.cz/auth/wifi/certifikat.pl',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: 'lang=cz&gen=x',
    });
    expect(d.httpGet).not.toHaveBeenCalled();
  });

  it('still routes a GET through httpGet, never httpPost', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(d.httpGet).toHaveBeenCalled();
    expect(d.httpPost).not.toHaveBeenCalled();
  });

  it('treats a lowercase method as POST', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'post',
      body: 'a=1',
    });
    expect(d.httpPost).toHaveBeenCalled();
  });

  it('applies the iOS Cookie header LAST so a caller cannot detach the session', async () => {
    const d = deps({ platform: 'ios' });
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'a=1',
      headers: { Cookie: 'UISAuth=attacker-supplied' },
    });
    const sent = (d.httpPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers.Cookie).toBe(`UISAuth=${TOKEN}`);
  });

  it('seeds the native jar for a POST on android too', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'a=1',
    });
    expect(d.setCookie).toHaveBeenCalled();
  });

  it('refuses a POST to a non-IS origin before sending anything', async () => {
    const d = deps();
    await expect(
      fetchViaCapacitor('https://evil.example.com/x', TOKEN, d, { method: 'POST', body: 'a=1' })
    ).rejects.toThrow(/refusing to send the IS session/);
    expect(d.httpPost).not.toHaveBeenCalled();
  });

  it('applies the sessionExpired rule to a POST as well', async () => {
    const d = deps({ httpPost: vi.fn(async () => ({ status: 403, data: '' })) });
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: 'POST', body: 'a=1' })
    ).rejects.toMatchObject({ sessionExpired: true });
  });

  // Regression: schedule.ts builds its POST body with `new URLSearchParams(...)`
  // and passes it straight through. The native bridge JSON.stringify's a
  // non-string `data`, and URLSearchParams has no enumerable own properties,
  // so it silently became "{}" — an empty body on the calendar's sync path.
  it('normalises a URLSearchParams body to its urlencoded string before it reaches httpPost', async () => {
    const d = deps();
    const params = new URLSearchParams({ rozvrh_student: '123', lang: 'cz' });
    await fetchViaCapacitor('https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl', TOKEN, d, {
      method: 'POST',
      body: params,
    });
    const sent = (d.httpPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { data: string };
    expect(sent.data).toBe('rozvrh_student=123&lang=cz');
  });

  it('throws instead of sending an unsupported body type', async () => {
    const d = deps();
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'POST',
        body: new FormData(),
      })
    ).rejects.toThrow();
    expect(d.httpPost).not.toHaveBeenCalled();
  });

  it('defaults Content-Type to form-urlencoded on a POST when the caller supplied none', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'a=1',
    });
    const sent = (d.httpPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('lets a caller-supplied Content-Type win over the default', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    });
    const sent = (d.httpPost as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers['Content-Type']).toBe('application/json');
  });

  it('does not add a Content-Type header to a GET, ever', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    const sent = (d.httpGet as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers).toEqual({});
  });

  it('sends exactly the caller headers on a GET — no additions of any kind', async () => {
    const d = deps();
    await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      headers: { 'X-Custom': 'value' },
    });
    const sent = (d.httpGet as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      headers: Record<string, string>;
    };
    expect(sent.headers).toEqual({ 'X-Custom': 'value' });
  });

  // Regression: the logout.pl gate is an HTML-only auth signal. schedule.ts POSTs
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
    const res = await fetchViaCapacitor(
      'https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl',
      TOKEN,
      d,
      { method: 'POST', body: 'format=json' }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"rozvrh":[]}');
  });

  it('carries the real content-type onto the Response — schedule.ts reads it to decide it got JSON', async () => {
    const d = deps({
      httpPost: vi.fn(async () => ({
        status: 200,
        data: '{"rozvrh":[]}',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      })),
    });
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'format=json',
    });
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
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'format=json',
    });
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.text()).toBe('{"rozvrh":[]}');
  });

  // Both native layers parse a JSON response body BEFORE it crosses the
  // bridge (Android's HttpRequestHandler.parseJSON, iOS's tryParseJson), so
  // `res.data` for a JSON response is already a parsed object, not a string.
  // `String(obj)` produces the literal text "[object Object]", which then
  // fails JSON.parse downstream — this is what broke fetchWeekSchedule on
  // mobile (rozvrhy_view.pl POSTs `format: "json"`).
  it('re-serialises a parsed-object POST response instead of stringifying it to "[object Object]"', async () => {
    const parsed = { rozvrh: [{ id: 1 }] };
    const d = deps({
      httpPost: vi.fn(async () => ({
        status: 200,
        data: parsed,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      })),
    });
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'format=json',
    });
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
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
    expect(await res.json()).toEqual(parsed);
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
    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
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
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: 'POST', body: 'a=1' })
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
    const res = await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
      method: 'POST',
      body: 'a=1',
    });
    expect(await res.text()).toContain('logout.pl');
  });

  // A response with no content-type at all keeps the old assumption: IS's HTML
  // pages are the overwhelming majority of this path, and a login page arriving
  // header-less must still be caught.
  it('treats a content-type-less body as HTML, so a bare login page is still refused', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({ status: 200, data: '<form action="/system/login.pl">' })),
    });
    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d)).rejects.toMatchObject({
      sessionExpired: true,
    });
  });

  // A PUT/PATCH/DELETE used to fall through to httpGet with the body dropped and
  // the caller saw a 200 — the exact silent-wrong-request shape this transport
  // exists to eliminate.
  it.each(['PUT', 'PATCH', 'DELETE'])(
    'refuses to send a %s rather than downgrading it',
    async (m) => {
      const d = deps();
      await expect(
        fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: m, body: 'a=1' })
      ).rejects.toThrow(/unsupported/i);
      expect(d.httpGet).not.toHaveBeenCalled();
      expect(d.httpPost).not.toHaveBeenCalled();
    }
  );
});

describe('normalizeCapacitorBody', () => {
  it('returns an empty string for a missing body', () => {
    expect(normalizeCapacitorBody(undefined)).toBe('');
    expect(normalizeCapacitorBody(null)).toBe('');
  });

  it('leaves a string body unchanged', () => {
    expect(normalizeCapacitorBody('rozvrh_student=123&lang=cz')).toBe('rozvrh_student=123&lang=cz');
  });

  it('serialises a URLSearchParams body to its urlencoded form', () => {
    // This is the exact bug: URLSearchParams has no enumerable own properties,
    // so JSON.stringify-ing it (what the native bridge does to non-string data)
    // silently produces "{}" — an empty POST body. String(params) is what a
    // browser would actually have put on the wire.
    const params = new URLSearchParams({ rozvrh_student: '123', lang: 'cz' });
    expect(normalizeCapacitorBody(params)).toBe('rozvrh_student=123&lang=cz');
  });

  it('throws for an unsupported body type instead of silently corrupting it', () => {
    expect(() => normalizeCapacitorBody(new FormData())).toThrow();
    expect(() => normalizeCapacitorBody(new Blob(['x']))).toThrow();
  });
});

describe('assertIsOrigin', () => {
  it('accepts the IS origin', () => {
    expect(() => assertIsOrigin('https://is.mendelu.cz/auth/x.pl?id=1')).not.toThrow();
  });

  it('rejects plain http, which would put the session on the wire in clear', () => {
    expect(() => assertIsOrigin('http://is.mendelu.cz/auth/')).toThrow(/refusing/i);
  });

  it('rejects a protocol-relative URL, which looks relative but is not', () => {
    // `//evil.example/x` resolves against the IS origin's SCHEME, not its host.
    expect(() => assertIsOrigin('//evil.example/x')).toThrow(/evil\.example/);
  });

  it('resolves a relative path against IS rather than rejecting it', () => {
    // Some links come from parsed IS HTML, which is not guaranteed absolute.
    expect(() => assertIsOrigin('/auth/student/')).not.toThrow();
  });
});
