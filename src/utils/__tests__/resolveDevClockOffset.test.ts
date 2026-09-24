import { describe, it, expect } from 'vitest';
import { resolveDevClockOffset } from '../resolveDevClockOffset';

const REAL = new Date(2026, 8, 23, 23, 31, 0); // late evening, as it happened

/**
 * `?now=10:30` moves the dev webapp's clock, so a state that only exists at a
 * given hour — a lesson running right now, its countdown, "Pak:" — can be
 * worked on at any hour. The fixture authors the lesson around `now`; this
 * moves `now` itself.
 */
describe('resolveDevClockOffset', () => {
  it('is null without the param', () => {
    expect(resolveDevClockOffset(null, REAL)).toBeNull();
  });

  it('moves the clock back to the named time on the same day', () => {
    const offset = resolveDevClockOffset('10:30', REAL)!;
    const shifted = new Date(REAL.getTime() + offset);
    expect(shifted.getHours()).toBe(10);
    expect(shifted.getMinutes()).toBe(30);
    expect(shifted.getDate()).toBe(REAL.getDate());
  });

  it('keeps the seconds of the real clock so the pulse still ticks', () => {
    const offset = resolveDevClockOffset('10:30', new Date(2026, 8, 23, 23, 31, 42))!;
    expect(new Date(new Date(2026, 8, 23, 23, 31, 42).getTime() + offset).getSeconds()).toBe(42);
  });

  it('takes a full date and time too', () => {
    const offset = resolveDevClockOffset('2026-05-04 08:15', REAL)!;
    const shifted = new Date(REAL.getTime() + offset);
    expect([shifted.getFullYear(), shifted.getMonth(), shifted.getDate()]).toEqual([2026, 4, 4]);
    expect(shifted.getHours()).toBe(8);
  });

  it('ignores something that is not a time', () => {
    expect(resolveDevClockOffset('brzy', REAL)).toBeNull();
    expect(resolveDevClockOffset('25:99', REAL)).toBeNull();
  });
});
