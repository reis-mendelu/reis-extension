// Render the Play Store feature graphic (1024x500) from the reIS logo.
//
// Play requires this asset on every listing and rejects it for two reasons that
// are easy to hit and only visible at upload time:
//
//   1. It must be OPAQUE. A PNG that keeps an alpha channel is rejected, which
//      is the opposite of the 512 app icon's rule (alpha required). The two
//      assets sit next to each other in the Console, so getting them backwards
//      is the default mistake — hence the assertion below rather than a comment.
//   2. It is CROPPED on some Play surfaces. Content is therefore kept inside a
//      centred 820x400 safe box, and the composition is centred rather than
//      flush-left, so a symmetric crop takes background off both sides.
//
// The mark (STYLE/ART/NAVY) and the renderer come from scripts/lib/reisLogo.mjs,
// the same source the Android and iOS icon generators read. Re-typing the
// artwork here is the drift that lib exists to prevent.
import {
  STYLE,
  ART,
  NAVY,
  launchBrowser,
  renderSvgToPngRect,
  pngColourType,
} from './lib/reisLogo.mjs';

const WIDTH = 1024;
const HEIGHT = 500;

/** Play crops toward the centre; everything readable stays inside this box. */
const SAFE = { w: 820, h: 400 };

/** The logo's accent, read off the dot in public/reIS_logo.svg. */
const LIME = '#79be15';

/**
 * A system stack, deliberately not a webfont. The generator has no network and
 * bundling a font file to render two lines of text is a poor trade — but it does
 * mean the wordmark's exact metrics follow the machine that runs this. Re-run it
 * on one machine when the graphic changes rather than diffing output across two.
 */
const FONT = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// Composition, in final pixels. The group is measured rather than nudged: its
// width decides the left edge, so changing the tagline recentres it for free.
const MARK = 168;
const GAP = 44;
const TEXT_W = 336; // widest line: the tagline at 32px in the stack above.
const GROUP_W = MARK + GAP + TEXT_W;
const LEFT = (WIDTH - GROUP_W) / 2;
const MID = HEIGHT / 2;

const graphic =
  () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">${STYLE}
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>

  <!-- Decorative echo of the logo dot. Bled off the right edge on purpose: a
       shape that is obviously clipped survives Play's crop, where a shape that
       sits just inside the frame would look accidentally cut. -->
  <circle cx="${WIDTH - 40}" cy="${HEIGHT + 60}" r="240" fill="${LIME}" opacity="0.10"/>
  <circle cx="60" cy="-70" r="170" fill="${LIME}" opacity="0.07"/>

  <!-- The mark, on its own rounded field, exactly as the launcher icon draws it. -->
  <g transform="translate(${LEFT}, ${MID - MARK / 2}) scale(${(MARK / 128).toFixed(5)})">
    <rect width="128" height="128" rx="24" fill="#0b1220"/>${ART}
  </g>

  <g transform="translate(${LEFT + MARK + GAP}, 0)" font-family="${FONT}">
    <text x="0" y="${MID - 6}" fill="#ffffff" font-size="92" font-weight="700"
          letter-spacing="-2">reIS</text>
    <text x="4" y="${MID + 46}" fill="${LIME}" font-size="32" font-weight="500"
          letter-spacing="0.5">IS MENDELU jednoduše</text>
  </g>
</svg>`;

const OUT = process.argv[2] ?? 'android/play-feature-graphic.png';

const browser = await launchBrowser();
try {
  // omitBackground: false over the opaque NAVY body is what makes Chromium emit
  // a PNG with no alpha channel at all — see renderSvgToPngRect.
  const buf = await renderSvgToPngRect(browser, graphic(), WIDTH, HEIGHT, OUT, {
    omitBackground: false,
  });

  // Assert Play's two hard rules against the bytes, not against intent. The
  // IHDR is fixed-offset: width at 16, height at 20, colour type at 25.
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== WIDTH || h !== HEIGHT) {
    throw new Error(`feature graphic must be ${WIDTH}x${HEIGHT}, got ${w}x${h}`);
  }
  const type = pngColourType(buf);
  if (type !== 2) {
    throw new Error(
      `feature graphic must have no alpha channel (PNG colour type 2), got type ${type} — ` +
        'something in the composition is letting the page background through'
    );
  }
  if (buf.length > 15 * 1024 * 1024) {
    throw new Error(`feature graphic must be under 15 MB, got ${buf.length}B`);
  }

  console.log(
    `${OUT} ${w}x${h} colour-type ${type} (no alpha) ${buf.length}B — ` +
      `content within ${SAFE.w}x${SAFE.h} safe box`
  );
} finally {
  await browser.close();
}
