import { describe, it, expect } from 'vitest';
import { digestText, digestLabels } from '../digestText';
import type { MapEvent } from '../../../types/events';

function ev(n: number, societyId = 'esn'): MapEvent {
  return {
    id: `e${n}`,
    title: `Akce ${n}`,
    url: '',
    date: '2026-10-06',
    endDate: null,
    time: '19:00',
    location: null,
    imageUrl: null,
    organizerKey: 'pef',
    societyId,
    coord: null,
    roomCode: null,
    venueKind: 'campus',
    category: 'party',
    createdAt: null,
  };
}

const many = (count: number) => Array.from({ length: count }, (_, i) => ev(i + 1));
const shortName = (id: string) => id.toUpperCase();

// Czech has three count forms (1 / 2–4 / 5+) and English two; one string with
// "{n} akce" read "Zítra 5 akce" and "+ 1 nové akce" on real lock screens.
describe('digest plurals — Czech', () => {
  const cz = digestLabels('cz');

  it.each([
    [1, '+ 1 nová akce od ESN'],
    [2, '+ 2 nové akce od ESN'],
    [5, '+ 5 nových akcí od ESN'],
  ])('%i new events → "%s"', (n, body) => {
    expect(digestText([ev(99)], many(n), shortName, cz)?.body).toBe(body);
  });

  it('new-only headline is singular for one event, plural for more', () => {
    expect(digestText([], many(1), shortName, cz)?.title).toBe('Nová akce: Akce 1 (ESN)');
    expect(digestText([], many(2), shortName, cz)?.title).toBe('Nové akce: Akce 1, Akce 2 (ESN)');
    expect(digestText([], many(5), shortName, cz)?.title).toBe('Nové akce: Akce 1, Akce 2 (ESN)');
  });

  // The many-events title only ever sees 3+ (up to two are listed by name),
  // so 1 and 2 are unreachable there by design; 3 is the few form, 5 the many.
  it('tomorrow with 3 events uses the few form, 5 the many form', () => {
    expect(digestText(many(3), [], shortName, cz)?.title).toBe(
      'Zítra 3 akce: Akce 1, Akce 2 a další'
    );
    expect(digestText(many(5), [], shortName, cz)?.title).toBe(
      'Zítra 5 akcí: Akce 1, Akce 2 a další'
    );
  });

  it('the label builder itself covers 1 / 2 / 5 for the many-events title', () => {
    expect(cz.tomorrowMany(1, 'X')).toBe('Zítra 1 akce: X');
    expect(cz.tomorrowMany(2, 'X')).toBe('Zítra 2 akce: X a další');
    expect(cz.tomorrowMany(5, 'X')).toBe('Zítra 5 akcí: X a další');
  });

  it('keeps the RSVP lead label byte-identical', () => {
    expect(cz.leadLabel).toBe('Za 2 hodiny');
  });
});

describe('digest plurals — English', () => {
  const en = digestLabels('en');

  it.each([
    [1, '+ 1 new event from ESN'],
    [2, '+ 2 new events from ESN'],
  ])('%i new events → "%s"', (n, body) => {
    expect(digestText([ev(99)], many(n), shortName, en)?.body).toBe(body);
  });

  it('new-only headline is singular for one event, plural for two', () => {
    expect(digestText([], many(1), shortName, en)?.title).toBe('New event: Akce 1 (ESN)');
    expect(digestText([], many(2), shortName, en)?.title).toBe('New events: Akce 1, Akce 2 (ESN)');
  });

  it('many-events title reads naturally for 1 and 2', () => {
    expect(en.tomorrowMany(1, 'X')).toBe('Tomorrow, 1 event: X');
    expect(en.tomorrowMany(2, 'X')).toBe('Tomorrow, 2 events: X and more');
  });
});
