import { describe, it, expect } from 'vitest';
import { anchoredScroll, clampScale, pinchScale, MAX_SCALE, MIN_SCALE } from '../pinchZoom';

describe('clampScale', () => {
  it('keeps a scale inside the bounds', () => {
    expect(clampScale(1.5)).toBe(1.5);
    expect(clampScale(9)).toBe(MAX_SCALE);
    expect(clampScale(0.1)).toBe(MIN_SCALE);
  });
});

describe('pinchScale', () => {
  it('scales by how far the fingers spread', () => {
    expect(pinchScale(1, 100, 200)).toBe(2);
    expect(pinchScale(2, 200, 100)).toBe(1);
  });

  it('clamps', () => {
    expect(pinchScale(1, 10, 1000)).toBe(MAX_SCALE);
    expect(pinchScale(1, 1000, 10)).toBe(MIN_SCALE);
  });

  it('ignores a gesture that started with both fingers on one point', () => {
    expect(pinchScale(1.2, 0, 100)).toBe(1.2);
  });
});

describe('anchoredScroll', () => {
  it('keeps the content under the fingers in place', () => {
    // Content x=150 sits under a finger at x=50 of the pane; doubling moves it
    // to x=300, which is under the finger again at scrollLeft 250.
    const start = { left: 100, top: 400 };
    expect(anchoredScroll(start, start, { x: 50, y: 100 }, 2)).toEqual({
      left: 250,
      top: 900,
    });
  });

  it('keeps a pan that happened during the pinch', () => {
    // Real fingers rarely land in the same frame: the first one can start a
    // native pan the browser will not give back. The preview was scaled around
    // the START offset, so the pane's travel since then is added on top rather
    // than snapped away.
    expect(
      anchoredScroll({ left: 100, top: 400 }, { left: 130, top: 360 }, { x: 50, y: 100 }, 2)
    ).toEqual({ left: 280, top: 860 });
  });

  it('never asks for a negative scroll', () => {
    const start = { left: 0, top: 0 };
    expect(anchoredScroll(start, start, { x: 200, y: 200 }, 0.5)).toEqual({ left: 0, top: 0 });
  });
});
