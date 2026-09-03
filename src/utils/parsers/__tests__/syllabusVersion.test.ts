import { describe, it, expect } from 'vitest';
import { SYLLABUS_VERSION, parseSyllabusOffline } from '../syllabusParser';

/**
 * The syllabus cache is validated by version equality, so the number the parser
 * STAMPS and the number the store REQUIRES have to be the same value. They
 * drifted once: b8b6e2f1 raised the store's constant to 4 to force a one-time
 * refetch ("newest predmetId") and left the parser stamping 3, which turned a
 * one-time flush into a permanent cache miss — every cold boot refetched every
 * syllabus from IS.
 *
 * Both sides now read this one constant, so the drift is unrepresentable rather
 * than merely tested for. This test guards the remaining way to reintroduce it:
 * hard-coding a literal back into the parsed record.
 */
describe('syllabus cache version', () => {
  it('stamps the shared SYLLABUS_VERSION on a parsed syllabus', () => {
    const html = `<html><body><h2>Požadavky na ukončení</h2><p>Zkouška.</p></body></html>`;
    expect(parseSyllabusOffline(html).version).toBe(SYLLABUS_VERSION);
  });

  it('keeps the "section not found" sentinel distinguishable from a real parse', () => {
    // Version 1 is the marker for unparseable input; it must never collide with
    // the current stamp, or a failed parse would satisfy the cache check.
    const notFound = parseSyllabusOffline('');
    expect(notFound.version).toBe(1);
    expect(notFound.version).not.toBe(SYLLABUS_VERSION);
  });
});
