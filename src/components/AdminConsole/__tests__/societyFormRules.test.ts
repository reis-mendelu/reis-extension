import { describe, it, expect } from 'vitest';
import { normalizeInstagram } from '../societyFormRules';

describe('normalizeInstagram', () => {
  it('strips @ and whitespace', () =>
    expect(normalizeInstagram('  @esnmendelubrno ')).toBe('esnmendelubrno'));
  it('empty means none', () => expect(normalizeInstagram('  ')).toBeNull());
  it('accepts a profile URL and keeps only the handle', () =>
    expect(normalizeInstagram('https://www.instagram.com/led_zf/')).toBe('led_zf'));
  it('rejects anything the database would', () => {
    expect(normalizeInstagram('a/b')).toBe('invalid');
    expect(normalizeInstagram('x'.repeat(31))).toBe('invalid');
  });
  // Every handle stored in production today must keep passing.
  it.each(['esnmendelubrno', 'au_frrms', 'uniestudentuaf', 'spldf_mendelu', 'led_zf'])(
    'keeps the production handle %s',
    (h) => expect(normalizeInstagram(h)).toBe(h)
  );
  // Instagram forbids a dot at either end and two in a row; `..` would even
  // build https://www.instagram.com/../, which is the homepage.
  it.each(['.esn', 'esn.', 'esn..mendelu', '..'])('rejects the dotted handle %s', (h) =>
    expect(normalizeInstagram(h)).toBe('invalid')
  );
  it('keeps underscores at the edges, which Instagram allows', () => {
    expect(normalizeInstagram('_esn_')).toBe('_esn_');
    expect(normalizeInstagram('esn.mendelu')).toBe('esn.mendelu');
  });
  // A post, reel or account URL names no profile: its first path segment
  // ("p", "reel", "accounts") used to be stored as the handle.
  it.each([
    'https://www.instagram.com/p/Cxyz123/',
    'https://www.instagram.com/reel/Cxyz123/',
    'https://instagram.com/reels/Cxyz123',
    'https://www.instagram.com/explore/tags/mendelu/',
    'https://www.instagram.com/accounts/login/',
    'https://www.instagram.com/stories/esnmendelubrno/123/',
    'https://www.instagram.com/tv/Cxyz123/',
    'https://www.instagram.com/direct/inbox/',
  ])('rejects the non-profile URL %s', (url) => expect(normalizeInstagram(url)).toBe('invalid'));
});
