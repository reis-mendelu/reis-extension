// Render the reIS logo into Android launcher icons via headless Chromium.
// The repo has no SVG rasteriser (no ImageMagick/rsvg/cairosvg), but Playwright's
// Chromium is already installed for e2e — and it renders the real SVG rather than
// approximating the R path with drawing primitives.
// From @playwright/test, which is the declared devDependency and re-exports
// chromium. Importing 'playwright' directly worked only because it happens to be
// hoisted underneath @playwright/test — an undeclared dependency that a fresh
// lockfile or a stricter installer is entitled to stop resolving.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Everything below is READ from the brand asset, never transcribed. An earlier
// version inlined a copy of the artwork here, which meant editing the logo and
// re-running this script produced the old icon — exactly the drift the file
// header claims cannot happen. Anything that cannot be found is a hard failure:
// falling back to a default would restore the drift silently.
const LOGO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../public/reIS_logo.svg');
const SOURCE = readFileSync(LOGO, 'utf8');

function extract(re, what) {
  const m = SOURCE.match(re);
  if (!m) {
    throw new Error(`${LOGO} has no ${what} — the generator cannot derive the icon from it`);
  }
  return m[1];
}

// Carried through verbatim so Chromium resolves `class="letter"` and the
// `var(--logo-bg, …)` fallbacks itself. Re-deriving those colours here is what
// let the copy diverge in the first place.
const STYLE = `<style>${extract(/<style>([\s\S]*?)<\/style>/, '<style> block')}</style>`;

/** The artwork group — the mark without the background rect behind it. */
const ART = extract(/(<g transform="translate\(7,0\)">[\s\S]*?<\/g>)/, 'artwork <g>');

/** The brand background, taken from the `--logo-bg` fallback in that <style>. */
const NAVY = extract(/--logo-bg,\s*(#[0-9a-fA-F]{3,8})/, '--logo-bg fallback colour');

/** Legacy square icon: the full brand mark, rounded corners and all. */
const full = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${STYLE}
    <rect width="128" height="128" rx="24" fill="${NAVY}"/>${ART}</svg>`;

/** Legacy round icon: same mark, circular field. */
const round = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${STYLE}
    <circle cx="64" cy="64" r="64" fill="${NAVY}"/>${ART}</svg>`;

// Painted extents in ART units, read off getBBox() rather than eyeballed. The
// dot's box includes the 2u of stroke that sits outside its r=16 circle.
const R_GLYPH = { x: 45, y: 40, w: 45, h: 48 };
const DOT = { cx: 39, cy: 96, r: 18 };

/** Inscribed circle of the 72dp visible zone on the 108dp canvas. */
const SAFE_R = 36;

/**
 * The anchor is an **optical centre**, weighted 75% toward the R.
 *
 * Three candidates were rendered against a crosshair and compared:
 *
 * - Centring the combined R+dot bounding box is what a naive fit does, and it
 *   looks wrong — the dot hangs far to the lower-left, so balancing the pair
 *   shoves the R visibly up and to the right of centre.
 * - Centring the R exactly fixes that, but the dot then swings out toward the
 *   mask edge and becomes the binding constraint, shrinking the mark to ~26.6dp.
 * - Weighting 75/25 toward the R reads as centred while letting the dot pull the
 *   composition back slightly, which buys size back (~28.7dp).
 *
 * The letter is what the eye reads as "the logo", so it dominates the anchor;
 * the dot is an accent and is allowed to sit off-axis.
 *
 * `maxScale` finds the largest scale where the R's corners and the whole dot
 * still sit inside the circular mask — the harshest shape a launcher applies.
 */
function maxScale(ax, ay) {
  const dist = (X, Y, s) => Math.hypot((X - ax) * s, (Y - ay) * s);
  const fits = (s) => {
    const corners = [
      [R_GLYPH.x, R_GLYPH.y],
      [R_GLYPH.x + R_GLYPH.w, R_GLYPH.y],
      [R_GLYPH.x, R_GLYPH.y + R_GLYPH.h],
      [R_GLYPH.x + R_GLYPH.w, R_GLYPH.y + R_GLYPH.h],
    ];
    if (corners.some(([X, Y]) => dist(X, Y, s) > SAFE_R)) return false;
    return dist(DOT.cx, DOT.cy, s) + DOT.r * s <= SAFE_R;
  };
  let lo = 0.1;
  let hi = 1.5;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** How much the R dominates the optical centre; 1 = R exactly centred. */
const R_WEIGHT = 0.75;

const foreground = () => {
  const rx = R_GLYPH.x + R_GLYPH.w / 2;
  const ry = R_GLYPH.y + R_GLYPH.h / 2;
  // Combined R+dot bounds, the counterweight the R is blended against.
  const ux =
    (Math.min(R_GLYPH.x, DOT.cx - DOT.r) + Math.max(R_GLYPH.x + R_GLYPH.w, DOT.cx + DOT.r)) / 2;
  const uy =
    (Math.min(R_GLYPH.y, DOT.cy - DOT.r) + Math.max(R_GLYPH.y + R_GLYPH.h, DOT.cy + DOT.r)) / 2;
  const ax = R_WEIGHT * rx + (1 - R_WEIGHT) * ux;
  const ay = R_WEIGHT * ry + (1 - R_WEIGHT) * uy;
  const s = maxScale(ax, ay);
  const tx = 54 - ax * s;
  const ty = 54 - ay * s;
  // STYLE must come along here too — ART carries `class="letter"`, and without
  // the rule the R silently renders black-on-navy instead of white.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${STYLE}
    <g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${s.toFixed(5)})">${ART}</g></svg>`;
};

const DENSITIES = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

const RES = process.argv[2];
if (!RES) {
  console.error('usage: gen-android-icons.mjs <path-to-res-dir>');
  process.exit(1);
}

// Check the target really is an Android res root before writing anything. The
// script mkdirSync(recursive)s its way to every output, so a mistyped path does
// not fail — it silently builds a mipmap tree somewhere harmless-looking and
// writes play-store-icon.png four levels above it. This marker is the res
// directory's own file, and it is one this PR edits.
if (!existsSync(`${RES}/values/ic_launcher_background.xml`)) {
  console.error(
    `not an Android res directory: ${RES}\n` +
      '(expected values/ic_launcher_background.xml beneath it)'
  );
  process.exit(1);
}

const browser = await chromium.launch();

async function render(svg, size, outPath) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
      <div style="width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>
    </body></html>`
  );
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  await page.close();
  return buf.length;
}

// try/finally, not a trailing close(): a screenshot or a write that throws
// half-way would otherwise leave the Chromium process alive for the shell to
// clean up by hand.
try {
  for (const [density, legacy, fg] of DENSITIES) {
    const dir = `${RES}/mipmap-${density}`;
    const a = await render(full(), legacy, `${dir}/ic_launcher.png`);
    const b = await render(round(), legacy, `${dir}/ic_launcher_round.png`);
    const c = await render(foreground(), fg, `${dir}/ic_launcher_foreground.png`);
    console.log(
      `${density}: launcher ${legacy}px (${a}B) round ${legacy}px (${b}B) fg ${fg}px (${c}B)`
    );
  }

  // A 512 mark for the Play listing, straight from the same source.
  await render(full(), 512, `${RES}/../../../../play-store-icon.png`);
  console.log('play-store-icon.png 512px');
} finally {
  await browser.close();
}
