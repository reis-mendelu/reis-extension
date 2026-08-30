import { describe, it, expect } from 'vitest';
import { isTrustedHostOrigin } from '../trustedOrigin';

describe('isTrustedHostOrigin', () => {
  it('accepts the injected host', () => {
    expect(isTrustedHostOrigin('https://is.mendelu.cz', false)).toBe(true);
  });

  it('accepts the extension itself', () => {
    expect(isTrustedHostOrigin('chrome-extension://abcdef', false)).toBe(true);
    expect(isTrustedHostOrigin('moz-extension://abcdef', false)).toBe(true);
  });

  it.each([
    'https://evil.example',
    // Was trusted while reIS injected an iframe there. The WebISKAM
    // integration is gone, so the origin must no longer be able to post
    // messages into the app.
    'https://webiskam.mendelu.cz',
    'https://is.mendelu.cz.evil.example',
    'http://is.mendelu.cz',
    'https://sub.is.mendelu.cz',
    '',
    'null',
  ])('rejects %s', (origin) => {
    expect(isTrustedHostOrigin(origin, false)).toBe(false);
  });

  it('accepts the localhost dev harness only when dev is true', () => {
    expect(isTrustedHostOrigin('http://localhost:3000', true)).toBe(true);
    expect(isTrustedHostOrigin('http://localhost:3000', false)).toBe(false);
  });

  it('does not let a lookalike host smuggle past the localhost rule', () => {
    // Prefix matching on "http://localhost" would accept this.
    expect(isTrustedHostOrigin('http://localhost.evil.example', true)).toBe(false);
  });
});
