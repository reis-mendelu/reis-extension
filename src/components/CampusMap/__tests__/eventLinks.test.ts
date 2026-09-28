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
    expect(eventDetailsLink({ url: 'javascript:alert(1)' }, { instagram: 'a' })?.kind).toBe(
      'instagram'
    ));
  it('never builds a link from an invalid handle', () =>
    expect(eventDetailsLink({ url: '' }, { instagram: 'a/b' })).toBeNull());
  it('null with neither', () => expect(eventDetailsLink({ url: '' }, {})).toBeNull());
});
