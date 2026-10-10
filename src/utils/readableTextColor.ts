// Pick black or white text for legibility on a solid colour fill. We compare the
// WCAG contrast ratio of each against the background and take the winner — a naive
// luminance threshold picks white on light-but-saturated brand colours (e.g. ESN
// cyan #00AEEF), which only reaches ~2.5:1 and fails. Used for society-coloured
// chips and the active RSVP buttons.

const DARK = '#111827'; // gray-900
const WHITE = '#ffffff';

function linear(channel8: number): number {
  const s = channel8 / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio between two #rrggbb colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Returns '#ffffff' or '#111827' — whichever has higher contrast on `hex`. */
export function readableTextColor(hex: string): string {
  const L = luminance(hex);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? WHITE : DARK;
}
