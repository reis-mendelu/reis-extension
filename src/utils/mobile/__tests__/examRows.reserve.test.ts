import { describe, it, expect } from 'vitest';
import { freeSeats } from '../examRows';
import type { ExamTerm } from '../../../types/exams';

const term = (over: Partial<ExamTerm>): ExamTerm => ({
  id: 't',
  date: '14.12.2026',
  time: '15:00',
  ...over,
});

describe('freeSeats with a reserve', () => {
  it('counts a reserve as taken: 59/60(1) has no free seat', () => {
    const t = term({ capacity: { occupied: 59, total: 60, raw: '59/60(1)', reserve: 1 } });
    expect(freeSeats(t)).toEqual({ free: 0, total: 60, reserve: 1 });
  });

  it('a reserve that leaves room is subtracted too', () => {
    const t = term({ capacity: { occupied: 50, total: 60, raw: '50/60(2)', reserve: 2 } });
    expect(freeSeats(t)).toEqual({ free: 8, total: 60, reserve: 2 });
  });

  it('no reserve: as before, with no reserve key', () => {
    const t = term({ capacity: { occupied: 15, total: 100, raw: '15/100' } });
    expect(freeSeats(t)).toEqual({ free: 85, total: 100 });
  });
});
