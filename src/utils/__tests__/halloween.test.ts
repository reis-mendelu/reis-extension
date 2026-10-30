import { describe, expect, it } from 'vitest';
import { isHalloween } from '../halloween';

// Local time on purpose: the window is a student's calendar days, wherever the
// device's clock says they are.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('isHalloween', () => {
  it('is off the evening before', () => {
    expect(isHalloween(at(2026, 10, 30, 23, 59))).toBe(false);
  });

  it('starts at midnight on 31 October', () => {
    expect(isHalloween(at(2026, 10, 31, 0, 0))).toBe(true);
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
