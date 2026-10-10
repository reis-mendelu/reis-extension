import { describe, it, expect } from 'vitest';
import { clampPageIndex, pageAtOffset } from '../pdfPagePosition';

describe('clampPageIndex', () => {
  it('keeps a page that exists', () => {
    expect(clampPageIndex(4, 10)).toBe(4);
  });

  // The teacher re-uploaded a shorter deck: land on its last page, not page 1.
  it('clamps a page past the end to the last page', () => {
    expect(clampPageIndex(30, 12)).toBe(11);
  });

  it('starts at the top when nothing was saved or the value is garbage', () => {
    expect(clampPageIndex(null, 10)).toBe(0);
    expect(clampPageIndex(undefined, 10)).toBe(0);
    expect(clampPageIndex(-3, 10)).toBe(0);
    expect(clampPageIndex(2.5, 10)).toBe(0);
    expect(clampPageIndex(Number.NaN, 10)).toBe(0);
  });

  it('is page 0 for a document with no pages', () => {
    expect(clampPageIndex(5, 0)).toBe(0);
  });
});

describe('pageAtOffset', () => {
  const tops = [0, 1000, 2000, 3000];

  it('is the last page whose top is at or above the reading line', () => {
    expect(pageAtOffset(tops, 0)).toBe(0);
    expect(pageAtOffset(tops, 999)).toBe(0);
    expect(pageAtOffset(tops, 1000)).toBe(1);
    expect(pageAtOffset(tops, 2500)).toBe(2);
  });

  it('is the last page once the line is past every top', () => {
    expect(pageAtOffset(tops, 99999)).toBe(3);
  });

  it('is page 0 above the first page or with no pages', () => {
    expect(pageAtOffset(tops, -50)).toBe(0);
    expect(pageAtOffset([], 500)).toBe(0);
  });
});
