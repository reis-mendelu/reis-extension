/**
 * Walk the app through one journey and record what a student would see.
 *
 *   npm run shot:route -- --from 49.218161,16.614118 --to Q --at "2026-09-21T10:00"
 *   npm run shot:route -- --all            # every journey in JOURNEYS below
 *
 * Why this exists rather than `verify:ui`: that tool seeds a view into
 * IndexedDB and screenshots it, deliberately never clicking, because clicking a
 * nav tab and shooting the result is how a stale preview lies to you. A route
 * cannot be seeded — it only exists after a position, a destination and a
 * clock have met — so this one does drive the UI, and pays for that by
 * asserting what it found rather than trusting the picture.
 *
 * Output lands in `.verify/routes/` (gitignored): a PNG per journey and one
 * `results.json` saying, for each, whether a route was drawn, how long it was,
 * which gates it used, and the exact sentence the card showed. That file is the
 * point — a screenshot proves a thing rendered, and only the JSON says whether
 * the answer was right.
 *
 * Requires the dev webapp on :3000 (`npm run dev:web`).
 */

import { chromium, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.cwd(), '.verify/routes');
const BASE = 'http://localhost:3000';
const WEEKDAY = '2026-09-21T10:00';
const WEEKEND = '2026-09-26T10:00';

interface Journey {
  id: string;
  label: string;
  from: string;
  to: string;
  at: string;
  /** What a student should get. Checked, not just photographed. */
  expect: 'route' | 'no-route' | 'too-far';
}

/** Where students actually start from. */
const JOURNEYS: Journey[] = [
  { id: 'frrms-weekday', label: 'FRRMS → Q, Monday morning', from: '49.218161,16.614118', to: 'Q', at: WEEKDAY, expect: 'route' },
  { id: 'frrms-weekend', label: 'FRRMS → Q, Saturday', from: '49.218161,16.614118', to: 'Q', at: WEEKEND, expect: 'no-route' },
  { id: 'frrms-evening', label: 'FRRMS → Q, 21:00 on a weekday', from: '49.218161,16.614118', to: 'Q', at: '2026-09-21T21:00', expect: 'no-route' },
  { id: 'jak-weekday', label: 'JAK dorms → Q, Monday', from: '49.216233,16.630584', to: 'Q', at: WEEKDAY, expect: 'route' },
  { id: 'jak-weekend', label: 'JAK dorms → Q, Saturday', from: '49.216233,16.630584', to: 'Q', at: WEEKEND, expect: 'route' },
  { id: 'midcampus', label: 'Between B and M → Q', from: '49.2106,16.6155', to: 'Q', at: WEEKDAY, expect: 'route' },
  { id: 'main-gate', label: 'Main gate → A', from: '49.210133,16.617241', to: 'A', at: WEEKDAY, expect: 'route' },
  { id: 'tram-zemedelska', label: 'Tram stop Zemědělská → X', from: '49.210481,16.618421', to: 'X', at: WEEKDAY, expect: 'route' },
  { id: 'arboretum-gate', label: 'Arboretum gate → E', from: '49.21122,16.614543', to: 'E', at: WEEKDAY, expect: 'route' },
  { id: 'prague', label: 'Prague → Q (not near campus)', from: '50.08,14.42', to: 'Q', at: WEEKDAY, expect: 'too-far' },
];

interface Result extends Journey {
  drawn: boolean;
  lengthM: number | null;
  minutes: number | null;
  gates: string[];
  status: string;
  card: string;
  png: string;
  pass: boolean;
  why: string;
}

async function openMap(page: Page, j: Journey) {
  await page.goto(`${BASE}/?at=${j.from}&now=${encodeURIComponent(j.at)}`, {
    waitUntil: 'domcontentloaded',
  });
  // The app hydrates from IndexedDB before the tab bar is usable.
  // The bottom-nav button carries aria-label="Mapa"; matching on text alone
  // also hits the search placeholder and the sheet's own headings.
  const mapTab = page.getByRole('button', { name: 'Mapa', exact: true });
  await mapTab.waitFor({ timeout: 30_000 });
  await mapTab.click();
  await page.waitForSelector('[data-testid="map-screen"]', { timeout: 20_000 });
  // Leaflet needs a beat to lay the basemap out before anything is measurable.
  await page.waitForTimeout(3000);
}

async function routeTo(page: Page, building: string) {
  await page.getByRole('button', { name: /Najdi cestu/ }).click();
  await page.waitForTimeout(500);
  // menuitem, not button: the letters sit in a role="menu" inside the sheet.
  await page.getByRole('menuitem', { name: building, exact: true }).click();
  await page.waitForTimeout(2800);
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.includes('--id')
    ? process.argv[process.argv.indexOf('--id') + 1]
    : null;
  const list = only ? JOURNEYS.filter((j) => j.id === only) : JOURNEYS;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const results: Result[] = [];

  for (const j of list) {
    await openMap(page, j);
    await routeTo(page, j.to);

    // The store is not on window, so this reads what the STUDENT can see: the
    // card's own sentence and the drawn geometry. That is the right level for
    // this check anyway — it is the answer they get, not the state behind it.
    // The status reads off the sheet now, not a floating card — it moved there
    // because a pale-green pill over an always-light basemap was invisible.
    const card = (
      await page
        .locator('[data-testid="map-sheet"]')
        .first()
        .innerText()
        .catch(() => '')
    ).trim();
    const drawn = await page.evaluate(
      () => document.querySelectorAll('path[stroke="#2563eb"][stroke-width="5"]').length > 0
    );
    const chip = await page
      .locator('.walk-chip')
      .first()
      .innerText()
      .catch(() => '');

    const minutes = /(\d+)\s*min/.exec(chip)?.[1] ?? /(\d+)\s*min/.exec(card)?.[1] ?? null;
    const gates = /ISIC/.test(card) ? ['garden'] : [];
    // Match the whole sentence, not a word in it. Reading the sheet rather
    // than a floating card means the peek row comes along too, and
    // "Akce na kampusu" matched a bare /kampusu/ — every closed-garden journey
    // was misreported as "not near the campus".
    const status = drawn
      ? 'route'
      : /Nejsi v okolí kampusu|not near the campus/i.test(card)
        ? 'too-far'
        : /Zahrada je zavřená|garden is closed/i.test(card)
          ? 'no-route'
          : /cesta nevede|no walk from here/i.test(card)
            ? 'unreachable'
            : 'unknown';

    const pass = status === j.expect;
    const png = resolve(OUT, `${j.id}.png`);
    await page.screenshot({ path: png });

    results.push({
      ...j,
      drawn,
      lengthM: null,
      minutes: minutes ? Number(minutes) : null,
      gates,
      status,
      card: card.replace(/\s+/g, ' '),
      png,
      pass,
      why: pass ? 'as expected' : `expected ${j.expect}, got ${status}`,
    });

    console.log(
      `${pass ? 'PASS' : 'FAIL'}  ${j.label.padEnd(38)} ${status.padEnd(9)} ${minutes ? minutes + ' min' : ''}`
    );
  }

  await browser.close();
  writeFileSync(resolve(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} journeys as expected — ${OUT}/results.json`);
  if (passed !== results.length) process.exitCode = 1;
}

void run();
