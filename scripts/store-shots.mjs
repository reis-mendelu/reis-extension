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
 * Size: 1080x1920, from a 360x640 viewport at deviceScaleFactor 3. Play caps
 * the aspect ratio of a phone screenshot at 2:1, so the tempting 1080x2400
 * (2.22:1) is rejected — 16:9 is the safe shape.
 */
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, '.store-shots');

const args = process.argv.slice(2);
const urlFlag = args.indexOf('--url');
const URL = urlFlag !== -1 ? args[urlFlag + 1] : 'http://localhost:4317';
const themeFlag = args.indexOf('--theme');
const THEME = themeFlag !== -1 ? args[themeFlag + 1] : 'dark';
// Only one fixture can be served at a time, and the screens want different
// ones — a teaching week for the calendar, an exam season for the exams tab.
// `--only` re-shoots a single screen against whichever server is running.
const onlyFlag = args.indexOf('--only');
const ONLY = onlyFlag !== -1 ? args[onlyFlag + 1] : null;

const WIDTH = 360;
const HEIGHT = 640;
const SCALE = 3;

/** Bottom-nav tabs, by their Czech accessible name. */
const SHOTS = [
  { name: '1-kalendar', tab: 'Kalendář' },
  { name: '2-zkousky', tab: 'Zkoušky' },
  { name: '3-predmety', tab: 'Předměty' },
  { name: '4-mapa', tab: 'Mapa' },
];

async function seedMeta(page, entries) {
  await page.evaluate(async (kv) => {
    await new Promise((done) => {
      const req = indexedDB.open('reis_db');
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('meta')) return done();
        const tx = db.transaction('meta', 'readwrite');
        const store = tx.objectStore('meta');
        for (const [k, v] of Object.entries(kv)) store.put(v, k);
        tx.oncomplete = () => done();
        tx.onerror = () => done();
      };
      req.onerror = () => done();
    });
  }, entries);
  await page.reload({ waitUntil: 'networkidle' });
}

const run = async () => {
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
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'networkidle' });
  // The welcome modal blurs the whole page behind it; every shot would be of it.
  await seedMeta(page, { welcome_dismissed: true, reis_theme: THEME });
  await page.waitForTimeout(1500);

  for (const { name, tab } of SHOTS.filter((s) => !ONLY || s.name === ONLY)) {
    const button = page.getByRole('button', { name: tab, exact: true });
    if ((await button.count()) === 0) {
      console.log(`  skip ${name} — no "${tab}" tab button on screen`);
      continue;
    }
    await button.first().click();
    // Tab transitions animate; a shot fired immediately catches a half-slid panel.
    await page.waitForTimeout(1200);
    const out = resolve(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: out });
    console.log(`  ${WIDTH * SCALE}x${HEIGHT * SCALE}  ${out}`);
  }

  await browser.close();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
