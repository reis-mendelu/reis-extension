import { describe, it, expect, vi } from 'vitest';
import {
  buildCookieDelivery,
  isAuthenticatedHtml,
  fetchViaCapacitor,
  assertIsOrigin,
  type CapacitorTransportDeps,
} from '../capacitorTransport';

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
