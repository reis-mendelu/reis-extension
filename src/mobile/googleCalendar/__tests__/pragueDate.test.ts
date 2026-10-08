import { describe, expect, it } from 'vitest';
import { academicWindow, pragueToday } from '../pragueDate';

describe('pragueToday', () => {
  it('is the Prague calendar date, not UTC', () => {
    // 23:30 UTC on 30 Sep is already 1 Oct in Prague (UTC+2 in summer)
    expect(pragueToday(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
  it('handles winter time', () => {
    expect(pragueToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('academicWindow', () => {
  it('October: 1 Sep this year to 31 Aug next year', () => {
    const w = academicWindow(new Date(2026, 9, 8));
    expect([w.start.getFullYear(), w.start.getMonth(), w.start.getDate()]).toEqual([2026, 8, 1]);
    expect([w.end.getFullYear(), w.end.getMonth(), w.end.getDate()]).toEqual([2027, 7, 31]);
  });
  it('January: previous 1 Sep to this 31 Aug', () => {
    const w = academicWindow(new Date(2027, 0, 15));
    expect(w.start.getFullYear()).toBe(2026);
    expect(w.end.getFullYear()).toBe(2027);
  });
  it('April: 1 Feb to 31 Aug', () => {
    const w = academicWindow(new Date(2027, 3, 1));
    expect([w.start.getMonth(), w.start.getDate()]).toEqual([1, 1]);
  });
});
