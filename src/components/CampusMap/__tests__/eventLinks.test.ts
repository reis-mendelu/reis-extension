import { describe, it, expect } from 'vitest';
import { eventDetailsLink } from '../eventLinks';

describe('eventDetailsLink', () => {
  it("prefers the event's own url", () =>
    expect(eventDetailsLink({ url: 'https://esn.cz/e' }, { instagram: 'x' })).toEqual({
      href: 'https://esn.cz/e',
      kind: 'event',
    }));
  it("falls back to the society's Instagram", () =>
    expect(eventDetailsLink({ url: '' }, { instagram: 'esnmendelubrno' })).toEqual({
      href: 'https://www.instagram.com/esnmendelubrno/',
      kind: 'instagram',
    }));
  it('ignores an unsafe event url and still falls back', () =>
    expect(eventDetailsLink({ url: 'javascript:alert(1)' }, { instagram: 'a' })).toEqual({
      href: 'https://www.instagram.com/a/',
      kind: 'instagram',
    }));
  it('an unsafe url with no usable handle gives no link at all', () =>
    expect(eventDetailsLink({ url: 'javascript:alert(1)' }, { instagram: '..' })).toBeNull());
  it('never builds a link from an invalid handle', () =>
    expect(eventDetailsLink({ url: '' }, { instagram: 'a/b' })).toBeNull());
  // `..` passes the database CHECK, and instagram.com/../ is the homepage.
  it.each(['..', '.esn', 'esn.', 'esn..mendelu'])('never links the dotted handle %s', (h) =>
    expect(eventDetailsLink({ url: '' }, { instagram: h })).toBeNull()
  );
  it.each(['esnmendelubrno', 'au_frrms', 'uniestudentuaf', 'spldf_mendelu', 'led_zf'])(
    'links the production handle %s',
    (h) => expect(eventDetailsLink({ url: '' }, { instagram: h })?.kind).toBe('instagram')
  );
  it('null with neither', () => expect(eventDetailsLink({ url: '' }, {})).toBeNull());
});
