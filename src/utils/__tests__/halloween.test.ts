import { describe, expect, it } from 'vitest';
import { isHalloween } from '../halloween';

// Local time on purpose: the window is a student's calendar days, wherever the
// device's clock says they are.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('isHalloween', () => {
  it('is off the evening before', () => {
    expect(isHalloween(at(2026, 10, 29, 23, 59))).toBe(false);
  });

  // A day early, so the Friday before Halloween already has it (Dominik,
  // 2026-10-30): the last teaching day before the weekend is when students
  // are in the app.
  it('starts at midnight on 30 October', () => {
    expect(isHalloween(at(2026, 10, 30, 0, 0))).toBe(true);
  });

  it('is on on Halloween itself', () => {
    expect(isHalloween(at(2026, 10, 31))).toBe(true);
  });

  it('is on through the week after', () => {
    expect(isHalloween(at(2026, 11, 2))).toBe(true);
  });

  it('is still on late on Friday 6 November', () => {
    expect(isHalloween(at(2026, 11, 6, 23, 59))).toBe(true);
  });

  it('is off from Saturday 7 November', () => {
    expect(isHalloween(at(2026, 11, 7, 0, 0))).toBe(false);
  });

  it('does not come back on its own next year', () => {
    expect(isHalloween(at(2027, 10, 31))).toBe(false);
  });
});
