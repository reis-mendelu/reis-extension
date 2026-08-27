/**
 * sanitizeStack produces `p_stack_excerpt` — one of the ten fields that LEAVE
 * THE DEVICE (telemetry.ts:99 -> 108). Its two siblings, sanitizeMessage and
 * sanitizeFilePath, were well covered; this one had no test anywhere in the repo,
 * so its PII redaction could be deleted entirely and the whole suite stayed
 * green while stack frames carrying student IDs and IS URLs went to Supabase.
 *
 * PRIVACY.md §6 and CLAUDE.md both state what must never be transmitted. A
 * promise nothing asserts is a promise that holds only by accident, and a stack
 * trace is the field most likely to carry the things it forbids — IS URLs with
 * `studium=` in them, usernames in extension paths, ids embedded in frames.
 *
 * Each pattern is asserted separately, and each on a realistic FRAME rather than
 * a bare string: the frame shape is what the redaction has to survive.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeStack } from '../sanitize';

/** Everything the caller sees must be redacted; assert the secret is gone. */
function clean(stack: string) {
  return sanitizeStack(stack);
}

describe('what must never leave the device', () => {
  it('redacts a student id embedded in an IS URL', () => {
    const out = clean(
      'Error: boom\n    at fetch (https://is.mendelu.cz/auth/student/list.pl?studium=123456:1:1)'
    );

    expect(out).not.toContain('123456');
    expect(out).not.toContain('is.mendelu.cz');
    expect(out).toContain('[redacted]');
  });

  it('redacts a bare 6-digit UIC in a frame', () => {
    const out = clean('Error: x\n    at handler (app.js:1:1) uic=654321');

    expect(out).not.toContain('654321');
  });

  it('redacts a 7-digit id too', () => {
    expect(clean('Error\n at f (a.js) 1234567')).not.toContain('1234567');
  });

  it('does NOT redact ordinary short numbers, which are line/column info', () => {
    // Over-redacting a stack destroys the only thing it is for.
    const out = clean('Error: x\n    at handler (app.js:42:7)');

    expect(out).toContain('42');
    expect(out).toContain('7');
  });

  it('redacts every email address, not just MENDELU ones', () => {
    // An Erasmus contact or a gmail typed by the student is still PII.
    const out = clean(
      'Error: mail failed\n    at send (a.js:1:1) to=xn12345@node.mendelu.cz cc=someone@gmail.com'
    );

    expect(out).not.toContain('xn12345@node.mendelu.cz');
    expect(out).not.toContain('someone@gmail.com');
  });

  it('redacts any mendelu.cz URL, subdomains included', () => {
    const out = clean(
      'Error\n at a (https://webiskam.mendelu.cz/Konta:1:1)\n at b (https://is.mendelu.cz/auth/:2:2)'
    );

    expect(out).not.toContain('webiskam.mendelu.cz');
    expect(out).not.toContain('is.mendelu.cz');
  });

  it('redacts bearer tokens and cookies', () => {
    const out = clean(
      'Error: auth\n    at f (a.js:1:1) Bearer eyJhbGciOi.J9.sig Cookie: UISAuth=abc123def'
    );

    expect(out).not.toContain('eyJhbGciOi.J9.sig');
    expect(out).not.toContain('UISAuth=abc123def');
  });

  it('strips the extension origin, which carries the install id', () => {
    // The extension id is per-install and pseudonymous — it is a device
    // identifier, and it appears in every single frame.
    const out = clean(
      'Error: x\n    at run (chrome-extension://abcdefghijklmnop/assets/main.js:10:5)'
    );

    expect(out).not.toContain('chrome-extension://');
    expect(out).not.toContain('abcdefghijklmnop');
    // The useful part survives.
    expect(out).toContain('assets/main.js');
  });

  it('strips a firefox extension origin too', () => {
    const out = clean('Error\n    at run (moz-extension://1234abcd-ef56/assets/main.js:1:1)');

    expect(out).not.toContain('moz-extension://');
  });

  it('redacts PII on EVERY frame, not only the first', () => {
    // A loop that stops early is the obvious way for this to regress.
    const out = clean(
      [
        'Error: x',
        '    at a (app.js:1:1)',
        '    at b (app.js:2:2)',
        '    at c (https://is.mendelu.cz/auth/x?studium=987654:3:3)',
      ].join('\n')
    );

    expect(out).not.toContain('is.mendelu.cz');
    expect(out).not.toContain('987654');
  });
});

describe('shape and bounds', () => {
  it('returns an empty string for anything that is not a string', () => {
    expect(sanitizeStack(undefined)).toBe('');
    expect(sanitizeStack(null)).toBe('');
    expect(sanitizeStack(42)).toBe('');
    expect(sanitizeStack({ stack: 'x' })).toBe('');
    expect(sanitizeStack('')).toBe('');
  });

  it('keeps the leading Error line as well as the frames', () => {
    const out = clean('TypeError: cannot read x\n    at a (app.js:1:1)');

    expect(out).toContain('TypeError: cannot read x');
    expect(out).toContain('app.js');
  });

  it('caps the number of frames it forwards', () => {
    const many = ['Error: x', ...Array.from({ length: 40 }, (_, i) => `    at f${i} (app.js:1:1)`)];

    const out = clean(many.join('\n'));

    // Far fewer than 40 frames survive — the cap is what stops a deep stack
    // becoming an unbounded payload.
    expect(out.split(' | ').length).toBeLessThan(20);
  });

  it('caps total length', () => {
    const out = clean('Error: ' + 'x'.repeat(5000));

    expect(out.length).toBeLessThanOrEqual(1000);
  });

  it('joins frames on a single line so the payload is one field', () => {
    const out = clean('Error: x\n    at a (app.js:1:1)\n    at b (app.js:2:2)');

    expect(out).not.toContain('\n');
    expect(out).toContain(' | ');
  });
});
