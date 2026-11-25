import { describe, it, expect } from 'vitest';
import { ExamSubjectSchema } from '../examSchema';

/**
 * Real IS capacity cell, read 2026-11-25 from terminy_seznam.pl (EBC-MNG,
 * 14.12.2026 15:00): "59/60(1)". IS's term detail says: přihlášeno 59,
 * kapacita 60, rezerva 1, and the action cell offers no "Přihlásit" — only the
 * watchdog and the reason page ("Tento termín je již obsazený"). So a reserve
 * takes the seat, and the term is full although 59 < 60.
 */
const parse = (capacity: string, full = false) => {
  const result = ExamSubjectSchema.parse({
    version: 1,
    id: 'EBC-MNG',
    name: 'Management',
    code: 'EBC-MNG',
    sections: [
      {
        id: 's',
        name: 'Zápočet',
        type: 'test',
        status: 'available',
        terms: [{ id: '1', date: '14.12.2026', time: '15:00', capacity, full }],
      },
    ],
  });
  // safe: fixed-shape fixture with one section and one term
  return result.sections[0]!.terms[0]!;
};

describe('capacity with a reserve "(n)"', () => {
  it('keeps the reserve and marks the term full when occupied + reserve reaches the capacity', () => {
    const t = parse('59/60(1)');
    expect(t.capacity).toEqual({ occupied: 59, total: 60, raw: '59/60(1)', reserve: 1 });
    expect(t.full).toBe(true);
  });

  it('a reserve that still leaves room does not fill the term', () => {
    const t = parse('50/60(2)');
    expect(t.capacity?.reserve).toBe(2);
    expect(t.full).toBe(false);
  });

  it('a term with no reserve is unchanged: no reserve key, full as the parser said', () => {
    const t = parse('10/20');
    expect(t.capacity).toEqual({ occupied: 10, total: 20, raw: '10/20' });
    expect(t.full).toBe(false);
    expect(parse('20/20', true).full).toBe(true);
  });

  it('never un-fills a term the parser already called full', () => {
    expect(parse('60/60(0)', true).full).toBe(true);
  });
});
