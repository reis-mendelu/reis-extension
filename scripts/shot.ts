/**
 * Screenshot + measure the reIS webapp at fixed mobile widths, and assert the
 * things that eyes and stale preview frames get wrong: horizontal overflow,
 * colliding text, and surfaces/text that are invisible against their backdrop.
 *
 *   npm run verify:ui -- exams-rail --view exams
 *   npm run verify:ui -- drawer --view subjects --click "EBC-IV" --theme light
 *
 * Conventions exist so results are comparable between runs and can't go stale:
 *   - widths are always 320 / 390 / 430 unless overridden
 *   - output always lands in .verify/ (gitignored), WIPED at the start of a run
 *   - the view is seeded into IndexedDB, never clicked — clicking a nav tab and
 *     screenshotting the result is how a hidden preview pane lies to you
 *   - every written path is printed absolute, so there is no "wrong out dir"
 *
 * Requires `npm run dev:web` to be serving on :3000.
 */

import { chromium, type Page } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeProbe,
  assertShell,
  describeShell,
  type Finding,
  type ProbeResult,
} from './lib/uiFindings';
import { probeSource } from './lib/uiProbe';

const DEFAULT_WIDTHS = [320, 390, 430];
const DEFAULT_URL = 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), '.verify');
// A phone's height. The desktop tree ships inside a full-window iframe, where
// the usable height is the browser window's — ~800px on a 1440x900 laptop, less
// with a bookmarks bar. `h-screen overflow-hidden` clips rather than scrolls, so
// height is a real variable there and --height exists to vary it.
const DEFAULT_VIEWPORT_HEIGHT = 844;

interface Options {
  label: string;
  url: string;
  widths: number[];
  view?: string;
  theme?: string;
  /** Texts to click in order after load. Repeat --click for a multi-step path
   *  (e.g. open a popover, expand a section, then hit the button inside it). */
  clicks: string[];
  wait: number;
  onboarding: boolean;
  height: number;
  /** Fail the run if the other shell rendered. See assertShell(). */
  expectShell?: 'desktop' | 'phone';
}

/**
 * `Number()` waves through NaN, Infinity and negatives, and `||` would treat
 * `--height 0` as "unset" and silently use the default. A viewport is not
 * something to guess at: a bad value should stop the run, the way an unknown
 * --expect-shell does.
 */
function parseHeight(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_VIEWPORT_HEIGHT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--height must be a positive finite number, not "${raw}"`);
    process.exit(2);
  }
  return value;
}

function parseExpectShell(raw: string | undefined): 'desktop' | 'phone' | undefined {
  if (!raw) return undefined;
  if (raw === 'desktop' || raw === 'phone') return raw;
  console.error(`--expect-shell takes "desktop" or "phone", not "${raw}"`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  const clicks: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      // Boolean flags take no value — don't swallow the next argument.
      const next = argv[i + 1];
      const value = next === undefined || next.startsWith('--') ? '' : argv[++i]!;
      // --click is the one repeatable flag: a Map would keep only the last one,
      // and reaching a surface can take several steps.
      if (a === '--click') clicks.push(value);
      else flags.set(a.slice(2), value);
    } else positional.push(a);
  }
  const rawLabel = positional[0];
  if (!rawLabel) {
    console.error(
      'usage: npm run verify:ui -- <label> [--view exams] [--theme dark] [--click TEXT ...]'
    );
    process.exit(2);
  }
  // The label becomes a filename. Anything with a separator or "…/.." in it
  // would write outside .verify/ — which is also the directory this script
  // wipes on every run, so an escaped path would silently survive and go stale.
  const label = rawLabel.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '');
  if (!label) {
    console.error(`label "${rawLabel}" has no usable characters — use letters, digits, - or _`);
    process.exit(2);
  }
  if (label !== rawLabel) console.log(`label sanitised to "${label}"`);
  const widths = flags.get('widths')?.split(',').map(Number).filter(Boolean) ?? DEFAULT_WIDTHS;
  return {
    label,
    url: flags.get('url') ?? DEFAULT_URL,
    widths,
    view: flags.get('view'),
    theme: flags.get('theme'),
    clicks,
    wait: Number(flags.get('wait') ?? 600),
    onboarding: flags.has('onboarding'),
    height: parseHeight(flags.get('height')),
    expectShell: parseExpectShell(flags.get('expect-shell')),
  };
}

/** Write a value into the app's `meta` IndexedDB store, then reload so the app
 *  boots with it. Deterministic where a nav click is not. */
/**
 * Seeds `meta` in whichever reIS database the page actually opened.
 *
 * The name is not fixed: `IndexedDBService` uses `reis_db_mock` when
 * VITE_USE_MOCK_DATA is set and `reis_db` otherwise, so a hard-coded name
 * silently seeds nothing against `npm run dev:web:mock` — `--view`, `--theme`
 * and the default `welcome_dismissed` all become no-ops and the run screenshots
 * the welcome modal over a blurred page while reporting "no findings". A clean
 * report from an unseeded page is worse than a failure, so this throws.
 *
 * `indexedDB.databases()` rather than opening both names: `open()` CREATES a
 * database that does not exist, which would leave an empty `reis_db` behind on
 * every mock run and confuse the next one.
 */
async function seedMeta(page: Page, entries: Record<string, unknown>): Promise<void> {
  if (Object.keys(entries).length === 0) return;
  // 'load' fires well before IndexedDBService has opened its database, so wait
  // for the precondition itself rather than for a navigation event that only
  // correlates with it. This is what makes the strict check below safe: a
  // failure now means the app never created a database, not that we looked too
  // early. Swallow the timeout — the explicit error below reports it better.
  await page
    .waitForFunction(
      async () => {
        const dbs = await indexedDB.databases();
        return dbs.some((d) => d.name === 'reis_db' || d.name === 'reis_db_mock');
      },
      undefined,
      { timeout: 15000 }
    )
    .catch(() => undefined);

  const seeded = await page.evaluate(async (kv) => {
    const names = (await indexedDB.databases())
      .map((d) => d.name)
      .filter((n): n is string => n === 'reis_db' || n === 'reis_db_mock');

    for (const name of names) {
      const ok = await new Promise<boolean>((done) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('meta')) return done(false);
          const tx = db.transaction('meta', 'readwrite');
          const store = tx.objectStore('meta');
          for (const [k, v] of Object.entries(kv)) store.put(v, k);
          tx.oncomplete = () => done(true);
          tx.onerror = () => done(false);
        };
        req.onerror = () => done(false);
      });
      if (ok) return name;
    }
    return null;
  }, entries);

  if (seeded === null) {
    throw new Error(
      'verify:ui: found no reIS IndexedDB with a `meta` store to seed. The page ' +
        'may not have booted, or it opened a database this script does not know ' +
        'about (see DB_NAME in src/services/storage/IndexedDBService.ts). ' +
        'Refusing to continue — an unseeded run reports a clean page it never set up.'
    );
  }
  // 'load', not 'networkidle': with a real snapshot the app keeps fetching
  // (files, syllabuses, classmates), so the network never goes idle and the
  // data-heaviest views — subjects, studyPlan — timed out at 30s while the
  // empty ones passed. The explicit `--wait` settle below is what actually
  // decides when the page is ready to measure.
  await page.reload({ waitUntil: 'load' });
}

/** Click a step of a `--click` path. Visible text first, then accessible name:
 *  icon-only controls (the phone shell's initials avatar, a bare chevron) carry
 *  their meaning in `aria-label`, and a text-only lookup can never reach the
 *  surfaces behind them. */
async function clickByTextOrLabel(page: Page, text: string): Promise<void> {
  // `visible: true` matters more than it looks: getByText matches hidden nodes
  // too, and this app keeps large ones around — a collapsed popover, and a
  // Leaflet pane whose descendants carry event titles. `.first()` on an
  // unfiltered query happily returns one of those and clicks nothing.
  const byText = page.getByText(text, { exact: false }).filter({ visible: true }).first();
  if ((await byText.count()) > 0) return byText.click();
  const byLabel = page.getByLabel(text, { exact: false }).filter({ visible: true }).first();
  if ((await byLabel.count()) > 0) return byLabel.click();
  throw new Error(`--click "${text}": no visible element with that text or accessible name`);
}

async function run(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));

  // Wipe first: reading a PNG left over from an earlier run is the exact failure
  // this script exists to prevent.
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const report: Record<
    string,
    { shot: string; findings: Finding[]; shell: string; height: number }
  > = {};
  let errorCount = 0;

  try {
    for (const width of opts.widths) {
      const context = await browser.newContext({
        viewport: { width, height: opts.height },
        deviceScaleFactor: 2,
        colorScheme: opts.theme === 'light' ? 'light' : 'dark',
      });
      const page = await context.newPage();
      // tsx compiles with esbuild's keepNames, which wraps functions in a
      // `__name(...)` helper. Playwright serialises `probeSource` by source
      // text, so that helper has to exist in the page or the probe dies with
      // "__name is not defined". String form: this shim must not be rewritten.
      await page.addInitScript({
        content: 'globalThis.__name = globalThis.__name || ((f) => f);',
      });
      const consoleErrors: string[] = [];
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

      // See the note in seedMeta: 'networkidle' cannot settle against real data.
      await page.goto(opts.url, { waitUntil: 'load' });
      // Dismiss onboarding by default — otherwise every run screenshots the
      // welcome modal and measures the blurred page behind it.
      const seed: Record<string, unknown> = opts.onboarding ? {} : { welcome_dismissed: true };
      if (opts.view) seed['reis_current_view'] = opts.view;
      // `createThemeSlice` accepts exactly two values and silently falls back
      // to the dark default for anything else, so seeding the raw flag made
      // `--theme light` a no-op that looked like it had worked.
      if (opts.theme) seed['reis_theme'] = opts.theme === 'light' ? 'mendelu' : 'mendelu-dark';
      await seedMeta(page, seed);

      // Settle BEFORE the first click, not only after the last one. seedMeta
      // reloads the page, so without this a --click races the app's boot and
      // fails on anything data-driven — the subject rows are painted from
      // IndexedDB, and every drawer run died with "no visible element" against
      // a screen that renders it perfectly a moment later.
      if (opts.clicks.length > 0) await page.waitForTimeout(opts.wait);

      for (const click of opts.clicks) {
        await clickByTextOrLabel(page, click);
        // Settle between steps: each click may mount the surface the next one
        // needs (a popover, an expanding section) behind an animation.
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(opts.wait);

      // Which shell actually mounted, before anything is measured or believed.
      const shell = describeShell(
        (await page.locator('[data-testid="desktop-app"]').count()) > 0,
        (await page.locator('[data-testid="mobile-app"]').count()) > 0
      );
      if (opts.expectShell) assertShell(opts.expectShell, shell, width);

      const shot = resolve(OUT_DIR, `${opts.label}-${width}.png`);
      await page.screenshot({ path: shot, fullPage: false });

      const probe = (await page.evaluate(probeSource)) as ProbeResult;
      const findings = analyzeProbe(probe);
      errorCount += findings.filter((f) => f.severity === 'error').length;
      report[String(width)] = { shot, findings, shell, height: opts.height };

      console.log(`\n\x1b[1m${width}x${opts.height}\x1b[0m  [${shell}]  ${shot}`);
      if (consoleErrors.length) {
        console.log(`  \x1b[31mconsole:\x1b[0m ${consoleErrors.length} error(s)`);
        for (const e of consoleErrors.slice(0, 3)) console.log(`    ${e.slice(0, 160)}`);
      }
      if (findings.length === 0) {
        console.log('  \x1b[32mno layout or contrast findings\x1b[0m');
      }
      for (const f of findings) {
        const tag = f.severity === 'error' ? '\x1b[31mERROR\x1b[0m' : '\x1b[33mwarn \x1b[0m';
        console.log(`  ${tag} ${f.kind}  ${f.sel}\n        ${f.detail}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const reportPath = resolve(OUT_DIR, `${opts.label}-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${reportPath}`);
  return errorCount > 0 ? 1 : 0;
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    console.error('\nIs `npm run dev:web` running on :3000?');
    process.exit(2);
  }
);
