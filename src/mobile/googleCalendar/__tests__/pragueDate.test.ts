import { describe, expect, it } from 'vitest';
import { pragueMidnight, pragueToday } from '../pragueDate';

describe('pragueToday', () => {
  it('is the Prague calendar date, not UTC', () => {
    // 23:30 UTC on 30 Sep is already 1 Oct in Prague (UTC+2 in summer)
    expect(pragueToday(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
  it('handles winter time', () => {
    expect(pragueToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('pragueMidnight', () => {
  it('uses the offset of an ordinary day', () => {
    expect(pragueMidnight(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-08T00:00:00+02:00');
    expect(pragueMidnight(new Date('2026-12-08T10:00:00Z'))).toBe('2026-12-08T00:00:00+01:00');
  });
  it('takes the offset at midnight, not now, on the autumn change day', () => {
    // 25 Oct 2026: midnight was +02:00, but by 10:00 UTC Prague is on +01:00
    expect(pragueMidnight(new Date('2026-10-25T10:00:00Z'))).toBe('2026-10-25T00:00:00+02:00');
  });
  it('and on the spring change day', () => {
    expect(pragueMidnight(new Date('2027-03-28T10:00:00Z'))).toBe('2027-03-28T00:00:00+01:00');
  });
});
