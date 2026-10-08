import { describe, it, expect } from 'vitest';
import { eventDetailsLink, eventDirectLink } from '../eventLinks';

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

// Every event imported from a semester list (all 45 live ones on 2026-10-08)
// carries a title and a date and nothing else: its card would repeat the row
// and hold one button. Such a row goes straight to that button's link.
describe('eventDirectLink', () => {
  const bare = {
    url: '',
    description: null,
    time: '',
    location: '',
    coord: null,
    roomCode: null,
    venueKind: 'tba' as const,
  };
  const esn = { instagram: 'esnmendelubrno' };

  it("goes straight to the society's Instagram when the card would add nothing", () =>
    expect(eventDirectLink(bare, esn)?.href).toBe('https://www.instagram.com/esnmendelubrno/'));
  it("goes to the event's own link when it has one", () =>
    expect(eventDirectLink({ ...bare, url: 'https://esn.cz/e' }, esn)?.href).toBe(
      'https://esn.cz/e'
    ));
  it.each([
    ['a description', { description: 'Bring a swimsuit' }],
    ['a time', { time: '20:00' }],
    ['a named place', { location: 'Klub Fléda', venueKind: 'offcampus' as const }],
    ['a dropped pin', { coord: [16.6, 49.2] as [number, number], venueKind: 'offcampus' as const }],
    ['a room', { roomCode: 'Q01', venueKind: 'campus' as const }],
    ['an online venue', { venueKind: 'online' as const }],
  ])('keeps the card when the event has %s', (_, extra) =>
    expect(eventDirectLink({ ...bare, ...extra }, esn)).toBeNull()
  );
  it('treats whitespace as nothing', () =>
    expect(eventDirectLink({ ...bare, description: '  ', location: ' ' }, esn)).not.toBeNull());
  it('keeps the card when there is nowhere to send the student', () =>
    expect(eventDirectLink(bare, {})).toBeNull());
});
