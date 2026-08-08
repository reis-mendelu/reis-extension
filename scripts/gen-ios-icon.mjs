// Render the reIS logo into the iOS app icon, from the same brand SVG the
// Android launcher icons come from (scripts/lib/reisLogo.mjs).
//
// iOS wants exactly ONE image — a 1024×1024 in the AppIcon set — and imposes two
// rules Android does not:
//
//   1. **No alpha channel.** App Store validation rejects an icon that has one.
//      Chromium emits PNG colour type 2 (no alpha) when the page is fully opaque
//      and type 6 when it is not, so the render happens over an opaque field and
//      the result is ASSERTED below rather than trusted.
//   2. **No rounded corners.** iOS applies its own superellipse mask. Baking a
//      radius in — as the Android legacy icon deliberately does — would show as a
//      dark fringe outside Apple's curve, so this draws a full-bleed square.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { STYLE, ART, NAVY, launchBrowser, renderSvgToPng, pngColourType } from './lib/reisLogo.mjs';

/** Full-bleed brand mark: square navy field, no radius, artwork as authored. */
const icon = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${STYLE}
    <rect width="128" height="128" fill="${NAVY}"/>${ART}</svg>`;

const SET = process.argv[2];
if (!SET) {
  console.error('usage: gen-ios-icon.mjs <path-to-AppIcon.appiconset>');
  process.exit(1);
}

// Same guard rail as the Android generator: without it a mistyped path does not
// fail, it quietly writes a PNG somewhere harmless-looking. Contents.json is the
// asset catalogue's own marker file.
const CONTENTS = resolve(SET, 'Contents.json');
if (!existsSync(CONTENTS)) {
  console.error(`not an AppIcon.appiconset: ${SET}\n(expected Contents.json inside it)`);
  process.exit(1);
}

// The filename is dictated by Contents.json, not chosen here — renaming the file
// without updating the catalogue produces a build that silently ships no icon.
const { images } = JSON.parse(await (await import('node:fs/promises')).readFile(CONTENTS, 'utf8'));
const entry = images.find((i) => i.size === '1024x1024');
if (!entry?.filename) {
  console.error(`${CONTENTS} declares no 1024x1024 filename to write`);
  process.exit(1);
}

const browser = await launchBrowser();
try {
  const out = resolve(SET, entry.filename);
  const buf = await renderSvgToPng(browser, icon(), 1024, out, { omitBackground: false });

  // A hard failure, not a warning: an icon with an alpha channel builds and runs
  // fine locally and is rejected at App Store submission, which is the worst
  // possible place to discover it.
  const type = pngColourType(buf);
  if (type !== 2) {
    throw new Error(
      `${entry.filename} has PNG colour type ${type}; iOS icons must have no alpha channel (type 2)`
    );
  }
  console.log(`${entry.filename} 1024px (${buf.length}B, colour type ${type} — no alpha)`);
} finally {
  await browser.close();
}
