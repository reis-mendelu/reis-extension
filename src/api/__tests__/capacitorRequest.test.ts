import { describe, it, expect } from 'vitest';
import {
  buildCapacitorRequestOptions,
  normalizeHeadersInit,
  readHeader,
} from '../capacitorRequest';
import { DEFAULT_HEADERS } from '../client';

describe('buildCapacitorRequestOptions', () => {
  // Regression guard for the whole branch: this is what client.ts's Capacitor
  // branch forwards to the transport. The transport's own tests prove it honours
  // these options; nothing proved they were ever supplied, so deleting them left
  // a POST silently executing as a bodyless GET with a fully green suite.
  it('forwards the method so a POST does not execute as a GET', () => {
    expect(buildCapacitorRequestOptions({ method: 'POST', body: 'a=1' }).method).toBe('POST');
  });

  it('forwards the body', () => {
    expect(buildCapacitorRequestOptions({ method: 'POST', body: 'lang=cz&gen=x' }).body).toBe(
      'lang=cz&gen=x'
    );
  });

  it('forwards a URLSearchParams body untouched — the transport is what serialises it', () => {
    const params = new URLSearchParams({ rozvrh_student: '123' });
    expect(buildCapacitorRequestOptions({ method: 'POST', body: params }).body).toBe(params);
  });

  it('forwards the caller headers', () => {
    expect(
      buildCapacitorRequestOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).headers
    ).toEqual({ 'Content-Type': 'application/json' });
  });

  // LOAD-BEARING. Headers must come from the caller's own options.headers, never
  // from client.ts's DEFAULT_HEADERS-merged local: the app's sync makes ~236 GETs
  // through this path, all device-verified with no caller headers, and merging
  // DEFAULT_HEADERS in would change every one of them on the wire.
  it('supplies no headers at all when the caller sent none', () => {
    expect(buildCapacitorRequestOptions({}).headers).toBeUndefined();
    expect(buildCapacitorRequestOptions({ method: 'GET' }).headers).toBeUndefined();
  });

  it('never leaks DEFAULT_HEADERS onto a request', () => {
    const built = buildCapacitorRequestOptions({ method: 'POST', body: 'a=1' });
    const sent = Object.keys(built.headers ?? {}).map((k) => k.toLowerCase());
    for (const key of Object.keys(DEFAULT_HEADERS)) {
      expect(sent).not.toContain(key.toLowerCase());
    }
  });

  // `HeadersInit` is a union and only one member survives an object spread.
  // Spreading a `Headers` yields `{}` — every caller header silently dropped,
  // which for a POST means losing the Content-Type and IS refusing the body.
  it('normalises a Headers instance instead of spreading it into nothing', () => {
    const built = buildCapacitorRequestOptions({
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
    expect(readHeader(built.headers, 'content-type')).toBe('application/json');
  });

  it('normalises an array of header pairs', () => {
    const built = buildCapacitorRequestOptions({
      method: 'POST',
      headers: [['Content-Type', 'text/plain']],
    });
    expect(readHeader(built.headers, 'content-type')).toBe('text/plain');
  });
});

describe('normalizeHeadersInit', () => {
  it('returns an empty record for a missing init', () => {
    expect(normalizeHeadersInit(undefined)).toEqual({});
  });

  it('copies a plain record rather than aliasing it', () => {
    const src = { A: '1' };
    const out = normalizeHeadersInit(src);
    expect(out).toEqual({ A: '1' });
    expect(out).not.toBe(src);
  });

  // Asserted through readHeader rather than on the exact key, because the
  // key casing a Headers iteration yields is implementation-dependent (the spec
  // lowercases; happy-dom preserves the original). Only the value is the
  // contract — the transport reads header names case-insensitively.
  it('reads a Headers instance, which has no enumerable own properties', () => {
    const out = normalizeHeadersInit(new Headers({ 'X-A': '1' }));
    expect(readHeader(out, 'x-a')).toBe('1');
  });

  it('reads an array of pairs', () => {
    expect(normalizeHeadersInit([['X-A', '1']])).toEqual({ 'X-A': '1' });
  });
});

describe('readHeader', () => {
  // The native layers disagree about casing: iOS lowercases every response
  // header key, Android forwards the server's own — so either spelling can
  // arrive, depending on the platform and on what IS itself sent.
  it('finds a header whatever its casing', () => {
    expect(readHeader({ 'content-type': 'application/json' }, 'Content-Type')).toBe(
      'application/json'
    );
    expect(readHeader({ 'Content-Type': 'text/html' }, 'content-type')).toBe('text/html');
  });

  it('returns undefined for a missing header or a missing bag', () => {
    expect(readHeader({ Accept: '*/*' }, 'content-type')).toBeUndefined();
    expect(readHeader(undefined, 'content-type')).toBeUndefined();
  });
});
