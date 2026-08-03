import { describe, it, expect } from 'vitest';
import {
  extractSessionToken,
  isPlausibleToken,
  buildRestoreScript,
  buildRestoreHeaders,
} from '../sessionToken';

// Shape-accurate, not a real session: 46 chars, URL-encoded, as IS issues them.
const REAL_SHAPE = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';

describe('extractSessionToken', () => {
  it('pulls UISAuth out of a cookie bag', () => {
    expect(extractSessionToken({ UISAuth: REAL_SHAPE })).toBe(REAL_SHAPE);
  });

  it('returns null when the cookie jar is empty (the post-app-kill case)', () => {
    expect(extractSessionToken({})).toBeNull();
  });

  it('returns null rather than an empty string for a blank value', () => {
    expect(extractSessionToken({ UISAuth: '' })).toBeNull();
  });

  it('ignores unrelated cookies', () => {
    expect(extractSessionToken({ other: 'x' })).toBeNull();
  });
});

describe('isPlausibleToken', () => {
  it('accepts a real-shaped token', () => {
    expect(isPlausibleToken(REAL_SHAPE)).toBe(true);
  });

  it('rejects non-strings and blanks', () => {
    expect(isPlausibleToken(undefined)).toBe(false);
    expect(isPlausibleToken(null)).toBe(false);
    expect(isPlausibleToken(42)).toBe(false);
    expect(isPlausibleToken('')).toBe(false);
  });

  it('rejects anything short enough to be a truncation bug', () => {
    expect(isPlausibleToken('abc')).toBe(false);
  });

  it('rejects characters a real token cannot contain', () => {
    // `;` would silently truncate the cookie; the quote/brace shapes are what a
    // code-injection attempt looks like. None of these can be a UISAuth value.
    expect(isPlausibleToken('AAAAAAAAAAAAAAAA;evil=1')).toBe(false);
    expect(isPlausibleToken('AAAAAAAAAAAAAAAA"+alert(1)+"')).toBe(false);
    expect(isPlausibleToken('AAAAAAAAAAAAAAAA</script>')).toBe(false);
    expect(isPlausibleToken('AAAAAAAAAAAAAAAA\\u0022')).toBe(false);
    expect(isPlausibleToken('AAAAAAAAAAAAAAAA\n')).toBe(false);
  });
});

describe('buildRestoreHeaders', () => {
  it('produces a Cookie header that authenticates request #1', () => {
    expect(buildRestoreHeaders(REAL_SHAPE)).toEqual({
      Cookie: `UISAuth=${REAL_SHAPE}`,
    });
  });
});

describe('buildRestoreScript', () => {
  it('sets the cookie without an expiry, so it stays a session cookie', () => {
    const s = buildRestoreScript(REAL_SHAPE);
    expect(s).toContain('document.cookie');
    expect(s).toContain(REAL_SHAPE);
    expect(s).toContain('path=/');
    expect(s).toContain('secure');
    expect(s.toLowerCase()).not.toContain('expires');
  });

  it('refuses to build a script around a token that is not a valid token', () => {
    // The token is the only untrusted input that reaches generated code, so it
    // is rejected outright rather than escaped: there is no legitimate token
    // this rejects, and escaping is a weaker promise than never emitting it.
    expect(() => buildRestoreScript('a"b')).toThrow(/token/i);
    expect(() => buildRestoreScript('AAAAAAAAAAAAAAAA";alert(1);"')).toThrow(/token/i);
  });

  it('emits only characters from the token charset', () => {
    expect(buildRestoreScript(REAL_SHAPE)).toContain(`"${REAL_SHAPE}"`);
  });

  it('never throws inside the page, whatever happens', () => {
    expect(buildRestoreScript(REAL_SHAPE)).toContain('catch');
  });
});
