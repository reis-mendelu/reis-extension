import { describe, it, expect } from 'vitest';
import {
  aspectFillScale,
  markFractionOnDevice,
  markSizeForDevices,
  IOS_DEVICES,
  type SplashDevice,
} from '../splashGeometry';

const CANVAS = 2732;
const MAX_FRACTION = 0.34;

describe('splash mark geometry', () => {
  // A 2732 square on a 2048x2732 iPad already covers it exactly.
  it('needs no scaling for the tablet it was authored for', () => {
    expect(aspectFillScale(CANVAS, { label: 'iPad', width: 2048, height: 2732 })).toBe(1);
  });

  // The square is scaled by the LONGER edge and judged against the shorter
  // one, which is the whole trap: a phone magnifies the mark and then has less
  // room for it.
  it('magnifies the mark on a tall phone', () => {
    const phone: SplashDevice = { label: 'iPhone 16 Pro Max', width: 1320, height: 2868 };
    const tablet: SplashDevice = { label: 'iPad Pro', width: 2048, height: 2732 };

    expect(markFractionOnDevice(CANVAS, 420, phone)).toBeGreaterThan(
      markFractionOnDevice(CANVAS, 420, tablet)
    );
  });

  it('sizes the mark so no shipped geometry exceeds the cap', () => {
    const mark = markSizeForDevices(CANVAS, IOS_DEVICES, MAX_FRACTION);

    for (const d of IOS_DEVICES) {
      expect(markFractionOnDevice(CANVAS, mark, d)).toBeLessThanOrEqual(MAX_FRACTION);
    }
  });

  // The cap has to BIND on the most elongated screen, or the mark is smaller
  // than it needs to be everywhere — a dot in the middle of an iPad.
  it('spends the whole budget on the device that constrains it', () => {
    const mark = markSizeForDevices(CANVAS, IOS_DEVICES, MAX_FRACTION);
    const worst = IOS_DEVICES.reduce((a, b) =>
      Math.max(a.height, a.width) / Math.min(a.height, a.width) >
      Math.max(b.height, b.width) / Math.min(b.height, b.width)
        ? a
        : b
    );

    expect(markFractionOnDevice(CANVAS, mark, worst)).toBeCloseTo(MAX_FRACTION, 2);
  });

  it('returns a whole number of pixels, so the mark cannot land half-lit', () => {
    expect(markSizeForDevices(CANVAS, IOS_DEVICES, MAX_FRACTION) % 1).toBe(0);
  });

  // Guards the direction of the relationship rather than a magic number: a
  // bigger allowance must draw a bigger mark.
  it('grows the mark when the allowance grows', () => {
    expect(markSizeForDevices(CANVAS, IOS_DEVICES, 0.4)).toBeGreaterThan(
      markSizeForDevices(CANVAS, IOS_DEVICES, 0.3)
    );
  });

  // The Capacitor default was ~5% of the square — visibly a placeholder, and
  // the reason the reported screen read as "a white screen with a logo on it"
  // rather than as an app opening.
  it('draws a mark that reads as branding, not as a spinner', () => {
    const mark = markSizeForDevices(CANVAS, IOS_DEVICES, MAX_FRACTION);
    const onIpad = markFractionOnDevice(CANVAS, mark, {
      label: 'iPad Pro',
      width: 2048,
      height: 2732,
    });

    expect(onIpad).toBeGreaterThan(0.15);
  });
});
