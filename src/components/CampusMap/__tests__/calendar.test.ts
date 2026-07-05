import { describe, it, expect } from 'vitest';
import { toISO, parseISO, monthMatrix, addMonths } from '../calendar';

describe('calendar helpers', () => {
  it('toISO builds a local YYYY-MM-DD (no UTC shift)', () => {
    expect(toISO(2026, 7, 2)).toBe('2026-08-02'); // m0=7 → August
    expect(toISO(2026, 0, 5)).toBe('2026-01-05');
  });
  it('parseISO round-trips', () => {
    expect(parseISO('2026-08-02')).toEqual({ y: 2026, m0: 7, d: 2 });
    expect(parseISO('nonsense')).toBeNull();
  });
  it('addMonths wraps the year', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ y: 2027, m0: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ y: 2025, m0: 11 });
  });
  it('monthMatrix is Monday-first and pads with null', () => {
    // July 2026: 1st is a Wednesday (Mon-first index 2) → first row starts null,null,1
    const wk = monthMatrix(2026, 6);
    expect(wk[0].slice(0, 3)).toEqual([null, null, 1]);
    expect(wk.flat().filter((d) => d !== null)).toHaveLength(31);
  });
});
