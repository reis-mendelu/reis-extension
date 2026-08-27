import { describe, it, expect } from 'vitest';
import { isTrustedProxyOrigin } from '../trustedOrigin';

const IS = 'https://is.mendelu.cz';

describe('isTrustedProxyOrigin', () => {
  it('accepts the IS parent origin on the extension', () => {
    expect(isTrustedProxyOrigin(IS, 'extension', 'chrome-extension://abc')).toBe(true);
  });

  it('rejects a foreign origin on the extension', () => {
    expect(
      isTrustedProxyOrigin('https://evil.example.com', 'extension', 'chrome-extension://abc')
    ).toBe(false);
  });

  it('accepts the app own origin on Capacitor — Android serves from https://localhost', () => {
    // Without this the loopback reply is silently dropped and every action
    // still times out, even with a responder in place.
    expect(isTrustedProxyOrigin('https://localhost', 'capacitor', 'https://localhost')).toBe(true);
  });

  it('accepts the app own origin on Capacitor — iOS serves from capacitor://localhost', () => {
    expect(
      isTrustedProxyOrigin('capacitor://localhost', 'capacitor', 'capacitor://localhost')
    ).toBe(true);
  });

  it('still rejects a foreign origin on Capacitor', () => {
    expect(isTrustedProxyOrigin('https://evil.example.com', 'capacitor', 'https://localhost')).toBe(
      false
    );
  });

  it('does NOT accept an arbitrary own-origin claim on the extension', () => {
    // The allowance is Capacitor-only on purpose: in the extension the iframe's
    // own origin must never be able to resolve its own pending requests.
    expect(
      isTrustedProxyOrigin('chrome-extension://abc', 'extension', 'chrome-extension://abc')
    ).toBe(false);
  });

  it('never trusts a null/opaque origin', () => {
    expect(isTrustedProxyOrigin('null', 'capacitor', 'https://localhost')).toBe(false);
    expect(isTrustedProxyOrigin('', 'capacitor', 'https://localhost')).toBe(false);
  });

  // The two cases above do NOT exercise the `origin === 'null'` guard: with an
  // ownOrigin of https://localhost they are already rejected by the final
  // `origin === ownOrigin` comparison, so deleting the guard leaves them green.
  //
  // The guard only decides the answer when the app's OWN origin is opaque too --
  // a sandboxed document reports origin 'null', and then 'null' === ownOrigin
  // and the capacitor branch would trust it. That is the case the guard exists
  // for, and it is the one that has to be asserted.
  it('does not trust an opaque origin even when its own origin is opaque', () => {
    expect(isTrustedProxyOrigin('null', 'capacitor', 'null')).toBe(false);
    expect(isTrustedProxyOrigin('', 'capacitor', '')).toBe(false);
  });
});
