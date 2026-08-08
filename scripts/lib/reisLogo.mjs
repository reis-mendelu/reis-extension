// Shared source-of-truth for icon generators: the reIS brand mark, READ from the
// SVG rather than transcribed.
//
// This module exists because a second generator (iOS) would otherwise need its
// own copy of the extraction below — and a copy is exactly the drift the Android
// generator was already burned by: an earlier version inlined the artwork, so
// editing the logo and re-running produced the OLD icon. One reader, two
// generators.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOGO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../public/reIS_logo.svg');
const SOURCE = readFileSync(LOGO, 'utf8');

function extract(re, what) {
  const m = SOURCE.match(re);
  if (!m) {
    throw new Error(`${LOGO} has no ${what} — the generator cannot derive the icon from it`);
  }
  return m[1];
}

/**
 * Carried through verbatim so Chromium resolves `class="letter"` and the
 * `var(--logo-bg, …)` fallbacks itself. Re-deriving those colours here is what
 * let the old copy diverge.
 */
export const STYLE = `<style>${extract(/<style>([\s\S]*?)<\/style>/, '<style> block')}</style>`;

/** The artwork group — the mark without the background rect behind it. */
export const ART = extract(/(<g transform="translate\(7,0\)">[\s\S]*?<\/g>)/, 'artwork <g>');

/** The brand background, taken from the `--logo-bg` fallback in that <style>. */
export const NAVY = extract(/--logo-bg,\s*(#[0-9a-fA-F]{3,8})/, '--logo-bg fallback colour');

export const launchBrowser = () => chromium.launch();

/**
 * Renders an SVG string to a PNG of exactly `size` square.
 *
 * `omitBackground` is the whole reason both callers can share this: Android's
 * adaptive foreground needs transparency, while an iOS app icon must be opaque.
 *
 * Worth knowing, because it saves writing a PNG encoder: Chromium emits colour
 * type 2 (truecolour, NO alpha channel) when the page is fully opaque, and type
 * 6 when it is not. So `omitBackground: false` over an opaque body is enough to
 * satisfy Apple's "must not contain an alpha channel" rule — measured, not
 * assumed, and asserted by the iOS generator rather than trusted.
 */
export async function renderSvgToPng(browser, svg, size, outPath, { omitBackground = true } = {}) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const body = omitBackground ? 'transparent' : NAVY;
  await page.setContent(
    `<html><body style="margin:0;background:${body}">
      <div style="width:${size}px;height:${size}px">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</div>
    </body></html>`
  );
  const buf = await page.screenshot({ omitBackground, type: 'png' });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  await page.close();
  return buf;
}

/** PNG colour type, byte 25 of the IHDR. 2 = truecolour, 6 = truecolour+alpha. */
export const pngColourType = (buf) => buf[25];
