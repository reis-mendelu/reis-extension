import { describe, it, expect } from 'vitest';
import { alternativeTerms, bookableFirst } from '../utils';
import type { ExamSection, ExamTerm } from '../../../types/exams';

const term = (id: string, over: Partial<ExamTerm> = {}): ExamTerm => ({
  id,
  date: '01.01.2027',
  time: '10:00',
  ...over,
});

/**
 * "A student who wants to quickly find a term to register for first scrolls
 * past every full term." The terms IS lists by date; the ones that can be
 * booked now go first, the rest follow in the same date order.
 */
describe('bookableFirst', () => {
  const full = (id: string) => term(id, { canRegisterNow: false, full: true });
  const open = (id: string) => term(id, { canRegisterNow: true });
  const notYet = (id: string) => term(id, { canRegisterNow: false });

  it('puts terms open for registration before full and not-yet-open ones', () => {
    const ordered = bookableFirst([full('a'), notYet('b'), open('c'), full('d'), open('e')]);
    expect(ordered.map((t) => t.id)).toEqual(['c', 'e', 'a', 'b', 'd']);
  });

  it('keeps the date order inside each group', () => {
    const ordered = bookableFirst([open('1'), full('2'), open('3'), full('4')]);
    expect(ordered.map((t) => t.id)).toEqual(['1', '3', '2', '4']);
  });

  it('does not count a term as open when a reserve takes its last seat', () => {
    const reserve = term('r', {
      canRegisterNow: true,
      capacity: { occupied: 59, total: 60, raw: '59/60(1)', reserve: 1 },
      full: true,
    });
    expect(bookableFirst([reserve, open('o')]).map((t) => t.id)).toEqual(['o', 'r']);
  });

  it('does not mutate its input', () => {
    const input = [full('a'), open('b')];
    bookableFirst(input);
    expect(input.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('is what a registered student sees as the other terms', () => {
    const section = {
      id: 's',
      name: 'Zkouška',
      type: 'exam',
      status: 'registered',
      registeredTerm: { id: 'mine', date: '01.01.2027', time: '10:00' },
      terms: [full('a'), term('mine', { canRegisterNow: false }), open('b')],
    } as unknown as ExamSection;
    expect(alternativeTerms(section).map((t) => t.id)).toEqual(['b', 'a']);
  });
});
