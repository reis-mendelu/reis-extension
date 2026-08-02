import { describe, it, expect, vi } from 'vitest';
import {
  buildCookieDelivery,
  isAuthenticatedHtml,
  fetchViaCapacitor,
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
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d),
    ).rejects.toMatchObject({ sessionExpired: true });
  });

  it('THROWS on a 200 that is not authenticated — a wrong-cookie-mechanism bug looks exactly like this', async () => {
    const d = deps({
      httpGet: vi.fn(async () => ({
        status: 200,
        data: '<form action="/system/login.pl">',
        headers: {},
      })),
    });
    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d),
    ).rejects.toMatchObject({ sessionExpired: true });
  });
});
