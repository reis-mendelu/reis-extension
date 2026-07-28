import { describe, it, expect } from 'vitest';
import {
  parseCssColor,
  compositeOver,
  relativeLuminance,
  contrastRatio,
  OPAQUE_WHITE,
  OPAQUE_BLACK,
} from '../contrast';

describe('parseCssColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseCssColor('#0f172a')).toEqual({ r: 15, g: 23, b: 42, a: 1 });
  });

  it('parses 3-digit hex by doubling nibbles', () => {
    expect(parseCssColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
  });

  it('parses 8-digit hex with alpha', () => {
    const c = parseCssColor('#0f172a80');
    expect(c).not.toBeNull();
    expect(c!.a).toBeCloseTo(128 / 255, 3);
  });

  it('parses legacy comma rgb()/rgba()', () => {
    expect(parseCssColor('rgb(15, 23, 42)')).toEqual({ r: 15, g: 23, b: 42, a: 1 });
    expect(parseCssColor('rgba(0, 0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('parses modern space-separated rgb() with slash alpha', () => {
    expect(parseCssColor('rgb(15 23 42 / 0.5)')).toEqual({ r: 15, g: 23, b: 42, a: 0.5 });
  });

  it('parses percentage alpha', () => {
    const c = parseCssColor('rgb(0 0 0 / 50%)');
    expect(c!.a).toBeCloseTo(0.5, 5);
  });

  it('treats transparent as fully transparent black', () => {
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  // The runtime path resolves colours through a canvas precisely because
  // Tailwind 4 / DaisyUI 5 emit oklch() — this parser is only for authoring
  // thresholds and must fail loudly rather than guess.
  it('returns null for colour spaces it cannot handle', () => {
    expect(parseCssColor('oklch(0.21 0.034 264.665)')).toBeNull();
    expect(parseCssColor('color-mix(in srgb, red, blue)')).toBeNull();
    expect(parseCssColor('not-a-colour')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance(OPAQUE_WHITE)).toBeCloseTo(1, 5);
    expect(relativeLuminance(OPAQUE_BLACK)).toBeCloseTo(0, 5);
  });

  it('uses the sRGB gamma curve, not a linear ramp', () => {
    // Mid-grey #808080 is ~0.216 relative luminance, not 0.5.
    expect(relativeLuminance({ r: 128, g: 128, b: 128, a: 1 })).toBeCloseTo(0.2158, 3);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio(OPAQUE_WHITE, OPAQUE_BLACK)).toBeCloseTo(21, 2);
  });

  it('is 1 for a colour against itself', () => {
    const c = { r: 15, g: 23, b: 42, a: 1 };
    expect(contrastRatio(c, c)).toBeCloseTo(1, 6);
  });

  it('is order-independent', () => {
    const a = { r: 15, g: 23, b: 42, a: 1 };
    const b = { r: 200, g: 30, b: 90, a: 1 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 6);
  });

  // Regression anchor for the bug found three separate times in the ExamsScreen
  // session: bg-base-300 (#111827) painted on a base-200 (#0f172a) surface in the
  // dark theme is effectively invisible. Any surface pair this close is a defect.
  it('scores base-300 on base-200 (dark theme) as effectively invisible', () => {
    const base200 = parseCssColor('#0f172a')!;
    const base300 = parseCssColor('#111827')!;
    expect(contrastRatio(base200, base300)).toBeLessThan(1.05);
  });

  it('scores a genuinely visible surface pair above the same threshold', () => {
    const base200 = parseCssColor('#0f172a')!;
    const lifted = parseCssColor('#334155')!; // slate-700
    expect(contrastRatio(base200, lifted)).toBeGreaterThan(1.05);
  });
});

describe('compositeOver', () => {
  it('returns the backdrop when the overlay is fully transparent', () => {
    const bg = { r: 15, g: 23, b: 42, a: 1 };
    expect(compositeOver({ r: 255, g: 0, b: 0, a: 0 }, bg)).toEqual(bg);
  });

  it('returns the overlay when it is fully opaque', () => {
    const fg = { r: 255, g: 0, b: 0, a: 1 };
    expect(compositeOver(fg, { r: 15, g: 23, b: 42, a: 1 })).toEqual(fg);
  });

  it('blends a half-transparent overlay toward the backdrop', () => {
    const out = compositeOver({ r: 255, g: 255, b: 255, a: 0.5 }, OPAQUE_BLACK);
    expect(out.r).toBeCloseTo(127.5, 1);
    expect(out.a).toBeCloseTo(1, 6);
  });

  // A semi-transparent divider over a near-identical backdrop is *more*
  // invisible than the opaque version — compositing must be applied before
  // the ratio is taken, or the assertion under-reports.
  it('makes a translucent near-match even closer to the backdrop', () => {
    const base200 = parseCssColor('#0f172a')!;
    const translucent = { ...parseCssColor('#334155')!, a: 0.15 };
    const composited = compositeOver(translucent, base200);
    expect(contrastRatio(base200, composited)).toBeLessThan(
      contrastRatio(base200, parseCssColor('#334155')!)
    );
  });
});
