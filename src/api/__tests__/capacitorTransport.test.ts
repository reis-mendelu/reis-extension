import { describe, it, expect } from 'vitest';
import { buildCookieDelivery, isAuthenticatedHtml, assertIsOrigin } from '../capacitorTransport';
import { TOKEN } from './capacitorDeps';

/**
 * The transport's pure helpers. `fetchViaCapacitor` itself is covered by
 * capacitorTransport.request.test.ts and capacitorTransport.response.test.ts.
 */

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
