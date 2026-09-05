import { describe, expect, it } from 'vitest';
import { failRateTone, failRateToneHover } from '../failRateTone';

describe('failRateTone', () => {
  it('bands at 20 and 25 percent', () => {
    expect(failRateTone(19.9)).toContain('bg-base-content/5');
    expect(failRateTone(20)).toContain('bg-warning');
    expect(failRateTone(24.9)).toContain('bg-warning');
    expect(failRateTone(25)).toContain('bg-error');
  });

  it('never sets the digits in a semantic colour', () => {
    // text-error on bg-error/10 measured 3.18:1 and text-warning-content
    // (white) on bg-warning/15 measured 1.15:1 — the pill warning you about a
    // hard subject was the least readable thing on the screen.
    for (const rate of [0, 19, 20, 24, 25, 80]) {
      const tone = failRateTone(rate);
      expect(tone).not.toContain('text-error');
      expect(tone).not.toContain('text-warning');
      expect(tone).toContain('text-base-content');
    }
  });

  it('pairs each band with a hover of the same hue', () => {
    expect(failRateToneHover(30)).toContain('error');
    expect(failRateToneHover(22)).toContain('warning');
    expect(failRateToneHover(5)).toContain('base-content');
  });
});
