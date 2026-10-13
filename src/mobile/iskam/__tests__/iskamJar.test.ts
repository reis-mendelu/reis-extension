import { describe, it, expect } from 'vitest';
import {
  applySetCookies,
  assertJarUrl,
  cookieHeader,
  jarFromRecord,
  splitSetCookie,
  type IskamJar,
} from '../iskamJar';

const ISKAM = 'https://webiskam.mendelu.cz/Konta';
const IDP = 'https://alibaba.mendelu.cz/idp/profile/SAML2/Redirect/SSO';
const NOW = Date.parse('2026-10-13T12:00:00Z');

describe('iskamJar', () => {
  it('splits a joined Set-Cookie header without breaking on commas inside Expires', () => {
    const joined =
      'shib_idp_persistent_ss=abc; Path=/idp; Expires=Wed, 13 Oct 2027 11:37:58 GMT; Secure, ' +
      'shib_idp_session=def; Path=/idp; HttpOnly, JSESSIONID=ghi; Path=/idp';
    expect(splitSetCookie(joined).map((s) => s.split('=')[0])).toEqual([
      'shib_idp_persistent_ss',
      'shib_idp_session',
      'JSESSIONID',
    ]);
    expect(splitSetCookie(undefined)).toEqual([]);
  });

  it('stores cookies host-only, so a webiskam cookie never goes to alibaba', () => {
    const jar = applySetCookies([], ISKAM, ['.ISKAMASPXAUTH=t1; path=/; HttpOnly'], NOW);
    expect(cookieHeader(jar, 'https://webiskam.mendelu.cz/Platby/x', NOW)).toBe(
      '.ISKAMASPXAUTH=t1'
    );
    expect(cookieHeader(jar, IDP, NOW)).toBe('');
  });

  it('ignores a Domain attribute that would widen the cookie', () => {
    const jar = applySetCookies([], ISKAM, ['wide=1; Domain=.mendelu.cz; Path=/'], NOW);
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idp/x', NOW)).toBe('');
  });

  it('scopes alibaba cookies to /idp', () => {
    const jar = applySetCookies([], IDP, ['shib_idp_session=s; Path=/idp'], NOW);
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idp/profile/x', NOW)).toBe(
      'shib_idp_session=s'
    );
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/other', NOW)).toBe('');
    expect(cookieHeader(jar, 'https://alibaba.mendelu.cz/idpx', NOW)).toBe('');
  });

  it('replaces a cookie with the same name and path, and deletes on Max-Age=0 or a past Expires', () => {
    let jar: IskamJar = applySetCookies([], ISKAM, ['a=1; Path=/', 'b=2; Path=/'], NOW);
    jar = applySetCookies(jar, ISKAM, ['a=3; Path=/'], NOW);
    expect(cookieHeader(jar, ISKAM, NOW)).toBe('b=2; a=3');
    jar = applySetCookies(
      jar,
      ISKAM,
      ['a=; Max-Age=0; Path=/', 'b=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/'],
      NOW
    );
    expect(cookieHeader(jar, ISKAM, NOW)).toBe('');
  });

  it('drops expired cookies from the header', () => {
    const jar = applySetCookies([], ISKAM, ['a=1; Path=/; Max-Age=60'], NOW);
    expect(cookieHeader(jar, ISKAM, NOW + 61_000)).toBe('');
  });

  it('refuses every host but webiskam and alibaba, and plain http', () => {
    expect(() => assertJarUrl('https://is.mendelu.cz/')).toThrow();
    expect(() => assertJarUrl('https://webiskam.mendelu.cz.evil.example/')).toThrow();
    expect(() => assertJarUrl('http://webiskam.mendelu.cz/')).toThrow();
    expect(() => assertJarUrl('https://gate.gopay.com/gw-ui/rest/v3/1')).toThrow();
    expect(() => applySetCookies([], 'https://evil.example/', ['a=1'], NOW)).toThrow();
    expect(() => cookieHeader([], 'https://evil.example/', NOW)).toThrow();
  });

  it('builds a jar from a getCookies record, skipping empty values', () => {
    const jar = jarFromRecord('alibaba.mendelu.cz', '/idp', { shib_idp_session: 's', empty: '' });
    expect(jar).toEqual([
      {
        name: 'shib_idp_session',
        value: 's',
        host: 'alibaba.mendelu.cz',
        path: '/idp',
        expires: null,
      },
    ]);
  });
});
