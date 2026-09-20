import { describe, it, expect } from 'vitest';
import { tooltipShift } from '../tooltipShift';

describe('tooltipShift', () => {
  const W = 320;

  it('leaves a label that already fits exactly where it is', () => {
    expect(tooltipShift(40, 200, W, 4)).toBe(0);
  });

  it('pulls back a label that runs off the right edge', () => {
    // the real one: "4 min · Hlavní brána ↔ Brána Lesnická" at 320 px ended at
    // 321. One pixel over is over.
    expect(tooltipShift(105, 216, W, 4)).toBe(-5);
  });

  it('pushes in a label that runs off the left edge', () => {
    expect(tooltipShift(-12, 200, W, 4)).toBe(16);
  });

  it('prefers the left edge when the label is wider than the map', () => {
    // Nothing can make it fit; showing the start of the text beats showing the
    // middle of it.
    expect(tooltipShift(-30, 400, W, 4)).toBe(34);
  });

  it('keeps the padding it was given', () => {
    expect(tooltipShift(300, 40, W, 0)).toBe(-20);
    expect(tooltipShift(300, 40, W, 10)).toBe(-30);
  });
});
