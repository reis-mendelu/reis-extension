#!/usr/bin/env node
/**
 * Capture Play Store phone screenshots from the dev webapp.
 *
 *   REIS_FIXTURE=teachingWeek npx vite --config vite.web.config.ts --port 4317
 *   node scripts/store-shots.mjs --url http://localhost:4317
 *
 * Why a script and not the phone: a screenshot taken on the developer's handset
 * shows a real student's name, real course enrolment and real grades, and a
 * Play listing is public forever. The dev webapp renders the SAME phone tree
 * from the same React source, so pointing it at a synthetic fixture gives a
 * listing image with nobody's data in it.
 *
 * Three store presets, selected with --preset:
 *
 *   play      1080x1920  (360x640 @3)   — Play caps a phone screenshot at 2:1,
 *                                          so the tempting 1080x2400 (2.22:1)
 *                                          is rejected; 16:9 is the safe shape.
 *   ios-6.9   1320x2868  (440x956 @3)   — App Store 6.9" iPhone, required.
 *   ios-13    2064x2752  (1032x1376 @2) — App Store 13" iPad, required because
 *                                          TARGETED_DEVICE_FAMILY is "1,2".
 *
 * Apple has no aspect cap; it wants those exact pixel counts, which is why the
 * iOS viewports are the pixel targets divided by the scale rather than real
 * device point sizes.
 */
// `@playwright/test` rather than `playwright`: only the former is declared in
// package.json. The bare `playwright` package is present today only as a
// transitive dependency, so importing it works right up until the dependency
// tree shifts underneath us.
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const URL = urlFlag !== -1 ? args[urlFlag + 1] : 'http://localhost:4317';
const themeFlag = args.indexOf('--theme');
const THEME = themeFlag !== -1 ? args[themeFlag + 1] : 'dark';
const presetFlag = args.indexOf('--preset');
const PRESET = presetFlag !== -1 ? args[presetFlag + 1] : 'play';
// Only one fixture can be served at a time, and the screens want different
// ones — a teaching week for the calendar, an exam season for the exams tab.
// `--only` re-shoots a single screen against whichever server is running.
const onlyFlag = args.indexOf('--only');
const ONLY = onlyFlag !== -1 ? args[onlyFlag + 1] : null;

/**
 * `forcePhone` exists only for the iPad preset. The native app ships the phone
 * tree on every device — `resolvePhoneViewport` returns true for
 * `isNativeApp` without measuring anything — but a browser at 1032px wide is
 * measured as desktop and would render the tree the iPad app never shows. The
 * shot has to match the app, so the browser is told it is narrow.
 */
const PRESETS = {
  play: { width: 360, height: 640, scale: 3, out: '.store-shots' },
  'ios-6.9': { width: 440, height: 956, scale: 3, out: '.store-shots-ios-6.9' },
  'ios-13': { width: 1032, height: 1376, scale: 2, out: '.store-shots-ios-13', forcePhone: true },
};

const preset = PRESETS[PRESET];
if (!preset) {
  console.error(`Unknown --preset "${PRESET}". Known: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}

const WIDTH = preset.width;
const HEIGHT = preset.height;
const SCALE = preset.scale;
const OUT_DIR = resolve(ROOT, preset.out);

/** Bottom-nav tabs, by their Czech accessible name. */
const SHOTS = [
  { name: '1-kalendar', tab: 'Kalendář' },
  { name: '2-zkousky', tab: 'Zkoušky' },
  { name: '3-predmety', tab: 'Předměty' },
  { name: '4-mapa', tab: 'Mapa' },
];

/**
 * Every failure below is fatal on purpose.
 *
 * Swallowing them leaves the welcome modal up, which blurs the whole page — so
 * a "successful" run writes four images of a frosted overlay and exits 0. A
 * listing asset that is silently wrong is worse than a run that stops.
 */
async function seedMeta(page, entries) {
  await page.evaluate(async (kv) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('reis_db');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) {
          return reject(
            new Error('IndexedDB has no "meta" store — is the app served at this URL?')
          );
        }
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        for (const [k, v] of Object.entries(kv)) store.put(v, k);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
        // A transaction can abort without ever firing onerror — quota exceeded,
        // an I/O failure, an explicit abort. Without this the promise simply
        // never settles and the run hangs instead of failing.
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    });
  }, entries);
  await page.reload({ waitUntil: 'networkidle' });
}

const run = async () => {
  // A typo in --only used to filter every shot away and still exit 0, which
  // reads exactly like "that screen is up to date".
  const selected = SHOTS.filter((s) => !ONLY || s.name === ONLY);
  if (ONLY && selected.length === 0) {
    throw new Error(`Unknown screenshot "${ONLY}". Known: ${SHOTS.map((s) => s.name).join(', ')}`);
  }

  // A targeted re-shoot must not wipe the screens captured against the other
  // fixture — that is the whole reason --only exists.
  if (!ONLY) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    colorScheme: THEME === 'light' ? 'light' : 'dark',
    locale: 'cs-CZ',
    hasTouch: true,
  });
  const page = await context.newPage();

  // Runs before any app code on every document, so AppShell's very first
  // matchMedia read already sees the forced answer — a patch applied after
  // load would be too late, the tree having already mounted as desktop.
  if (preset.forcePhone) {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (/max-width/.test(query)) {
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          };
        }
        return real(query);
      };
    });
  }

  await page.goto(URL, { waitUntil: 'networkidle' });
  // The welcome modal blurs the whole page behind it; every shot would be of it.
  await seedMeta(page, { welcome_dismissed: true, reis_theme: THEME });

  // Wait for the bottom nav rather than for a stopwatch. The store hydrates
  // from IndexedDB asynchronously after the reload, so a fixed delay is a bet
  // on how long that takes on this machine today — it shoots a half-built
  // screen when the bet is short and wastes time when it is long. The nav is
  // rendered by the phone tree itself, so its arrival is the app being up.
  await page.getByRole('button', { name: SHOTS[0].tab, exact: true }).first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });

  const missing = [];
  for (const { name, tab } of selected) {
    const button = page.getByRole('button', { name: tab, exact: true });
    if ((await button.count()) === 0) {
      missing.push(`${name} (no "${tab}" tab button on screen)`);
      continue;
    }
    await button.first().click();
    // BottomNav sets aria-current="page" on the active tab, so this waits for
    // the transition to have actually landed instead of guessing its duration.
    await button
      .and(page.locator('[aria-current="page"]'))
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 });
    // The panel cross-fades after the nav state flips, and that animation is
    // CSS with no completion signal in the DOM — so this one stays a wait on
    // the clock. A shot fired early catches a half-slid panel.
    await page.waitForTimeout(600);
    const out = resolve(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: out });
    console.log(`  ${WIDTH * SCALE}x${HEIGHT * SCALE}  ${out}`);
  }

  await browser.close();

  // Reported as a failure, not a skip. The bottom nav carries all four tabs on
  // every fixture, so a missing one means the app did not render — and the
  // previous run's file is still sitting in .store-shots, ready to be uploaded
  // as if it were current.
  if (missing.length > 0) {
    throw new Error(`Not captured:\n  ${missing.join('\n  ')}`);
  }
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
