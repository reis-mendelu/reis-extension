/**
 * Pure sRGB colour maths for the UI verification script (`scripts/shot.ts`).
 *
 * Why this exists: the dark theme's `base-200` (#0f172a) and `base-300`
 * (#111827) differ by a contrast ratio of ~1.006 — a divider or card painted in
 * one on top of the other is invisible on screen but perfectly plausible in the
 * source. Reading code never catches it; measuring computed colours does.
 *
 * Split from the browser side deliberately: Tailwind 4 / DaisyUI 5 emit
 * `oklch()`, which Chrome serialises verbatim from getComputedStyle. The runtime
 * resolves every colour through a canvas (which handles any colour space the
 * browser understands) and hands numeric RGBA to this module, so all the maths
 * stays pure and testable in Node.
 */

export interface Rgba {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export const OPAQUE_WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
export const OPAQUE_BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const RGB_RE = /^rgba?\(([^)]+)\)$/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Parse an alpha token that may be a 0-1 number or a percentage. */
function parseAlpha(token: string): number {
  const t = token.trim();
  const n = parseFloat(t);
  if (Number.isNaN(n)) return 1;
  return clamp(t.endsWith('%') ? n / 100 : n, 0, 1);
}

/**
 * Parse hex and rgb()/rgba() colours (legacy comma and modern space/slash forms).
 * Returns null for anything else — including oklch() and color-mix(), which must
 * be resolved by the browser rather than guessed at here.
 */
export function parseCssColor(input: string): Rgba | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const hex = HEX_RE.exec(s);
  if (hex) {
    const h = hex[1]!;
    const expand = (c: string) => parseInt(c.length === 1 ? c + c : c, 16);
    if (h.length === 3 || h.length === 4) {
      return {
        r: expand(h[0]!),
        g: expand(h[1]!),
        b: expand(h[2]!),
        a: h.length === 4 ? expand(h[3]!) / 255 : 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: expand(h.slice(0, 2)),
        g: expand(h.slice(2, 4)),
        b: expand(h.slice(4, 6)),
        a: h.length === 8 ? expand(h.slice(6, 8)) / 255 : 1,
      };
    }
    return null;
  }

  const rgb = RGB_RE.exec(s);
  if (rgb) {
    // Accept "r, g, b, a" and "r g b / a" in one pass.
    const [channels, slashAlpha] = rgb[1]!.split('/');
    const parts = channels!.trim().split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const chan = (t: string) =>
      clamp(t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t), 0, 255);
    const r = chan(parts[0]!);
    const g = chan(parts[1]!);
    const b = chan(parts[2]!);
    if ([r, g, b].some(Number.isNaN)) return null;
    const alphaToken = slashAlpha ?? parts[3];
    return { r, g, b, a: alphaToken === undefined ? 1 : parseAlpha(alphaToken) };
  }

  return null;
}

/**
 * Composite a (possibly translucent) overlay onto an opaque backdrop.
 * Must run before any ratio is taken: a 15%-alpha divider over a near-identical
 * surface is *more* invisible than its opaque colour suggests.
 */
export function compositeOver(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return { ...fg };
  if (fg.a <= 0) return { ...bg };
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return {
    r: mix(fg.r, bg.r),
    g: mix(fg.g, bg.g),
    b: mix(fg.b, bg.b),
    a: 1,
  };
}

/** WCAG relative luminance. Alpha is ignored — composite first. */
export function relativeLuminance(c: Rgba): number {
  const channel = (v: number) => {
    const s = clamp(v, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). Order-independent. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
