/**
 * Loads a built reIS web bundle in a real browser and reports whether it works.
 *
 *   npm run check:app          # demo data — no credentials, runs in CI
 *   npm run check:app -- --real  # your sanitised snapshot, local only
 *
 * Every judgement lives in scripts/appHealth.ts, which is unit-tested. This
 * file only gathers facts and serves the build.
 *
 * Why this exists: on 2026-09-04 six real defects were each found by hand, one
 * verification at a time — a build stuck on skeletons, a page writing to
 * production Supabase, a real student record in the output, three guards dead
 * in a production build. Every one of them is a rule in appHealth.ts now.
 */

import { chromium, type Browser, type Page } from 'playwright';
import { analyzeProbe, type Finding, type ProbeResult } from './lib/uiFindings';
import { probeSource } from './lib/uiProbe';
import { MOBILE_TABS } from '../src/store/types';
import { createServer, type ViteDevServer } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateHealth,
  formatHealthReport,
  type HealthObservations,
  type ObservedRequest,
} from './appHealth';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'dist-web');
const PORT = Number(process.env.CHECK_APP_PORT) || 4271;

/** How long the app gets to settle before the page is judged. */
const SETTLE_MS = 4000;

/** Minimal shape of the store handle `dev/storeHandle.ts` publishes. */
type AppStoreHandle = {
  getState: () => { setMobileTab: (t: string) => void; setTheme: (t: string) => Promise<void> };
};

/** The widths the app claims to support. Same three `scripts/shot.ts` uses. */
const WIDTHS = [320, 390, 430];

/**
 * Both themes, by the value `createThemeSlice` accepts. The slice takes exactly
 * these two and silently falls back to the dark default for anything else, so
 * the raw word "light" measures the dark page and looks like it worked.
 */
const THEMES = { dark: 'mendelu-dark', light: 'mendelu' } as const;

function parseMode(argv: string[]): 'demo' | 'real' {
  return argv.includes('--real') ? 'real' : 'demo';
}

async function collect(page: Page, mode: 'demo' | 'real'): Promise<HealthObservations> {
  // Method as well as URL: every supabase.rpc() is a POST, so the write rule
  // needs both to tell a read-only RPC from a write.
  const requests: ObservedRequest[] = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));

  await page.goto(`http://localhost:${PORT}/?mobile=1`, { waitUntil: 'load' });
  await page.waitForTimeout(SETTLE_MS);

  const { storeCounts, skeletonCount, textLength } = await page.evaluate(async () => {
    const counts: Record<string, number> = {};
    try {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const q = indexedDB.open('reis_db');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        counts[store] = await new Promise<number>((res) => {
          const c = db.transaction(store).objectStore(store).count();
          c.onsuccess = () => res(c.result);
          // -1, not 0: evaluateHealth reports an unreadable store distinctly
          // from an empty one, and neither is allowed to read as healthy.
          c.onerror = () => res(-1);
        });
      }
    } catch {
      // Leaving counts empty makes every required store read as missing, which
      // is the correct verdict: the app never opened its database.
    }
    return {
      storeCounts: counts,
      skeletonCount: document.querySelectorAll('.skeleton').length,
      textLength: document.body.innerText.trim().length,
    };
  });

  // Every phone tab, both themes, every width.
  //
  // Driven through the store rather than by seeding `meta.reis_current_view`:
  // that key drives the DESKTOP sidebar, and the phone shell reads `mobileTab`
  // from createMobileUiSlice. Seeding it left all eight "views" rendering the
  // calendar — a sweep that measured one screen 24 times and reported success.
  // Clicking the nav instead would key the whole gate on Czech labels.
  const visual: Record<string, Finding[]> = {};
  for (const [themeName, themeValue] of Object.entries(THEMES)) {
    await page.evaluate(async (t) => {
      await (window as unknown as { __reisStore: AppStoreHandle }).__reisStore
        .getState()
        .setTheme(t as never);
    }, themeValue);
    for (const tab of MOBILE_TABS) {
      await page.evaluate((t) => {
        (window as unknown as { __reisStore: AppStoreHandle }).__reisStore
          .getState()
          .setMobileTab(t as never);
      }, tab);
      // Let the screen mount and any entrance animation land; a rect read
      // mid-transition reports a position nothing was ever rendered at.
      await page.waitForTimeout(600);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(300);
        const probe = (await page.evaluate(probeSource)) as ProbeResult;
        visual[`${tab} ${width}px ${themeName}`] = analyzeProbe(probe);
      }
    }
  }

  return {
    requests,
    storeCounts,
    skeletonCount,
    textLength,
    outputFiles: readdirSync(OUT_DIR),
    mode,
    visual,
  };
}

async function run(): Promise<number> {
  const mode = parseMode(process.argv.slice(2));

  if (!existsSync(resolve(OUT_DIR, 'index.html'))) {
    console.error(
      `\nNo build found at dist-web/.\nRun \`npm run build:web\` first (or \`npm run build:web:real\` for --real).\n`
    );
    return 1;
  }
  if (mode === 'real' && !existsSync(resolve(OUT_DIR, 'preview-data.json'))) {
    console.error(
      `\n--real was asked for, but dist-web/preview-data.json is missing.\nRun \`npm run sanitise:snapshot && npm run build:web:real\`.\n`
    );
    return 1;
  }

  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  try {
    // `vite preview` semantics without spawning a second process: serves the
    // built output with the SPA fallback the deployed page also has.
    server = await createServer({
      root: OUT_DIR,
      configFile: false,
      server: { port: PORT, strictPort: true },
      appType: 'spa',
    });
    await server.listen();

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    // tsx compiles with esbuild's keepNames, which wraps functions in a
    // `__name(...)` helper. Playwright serialises `probeSource` by source text,
    // so that helper must exist in the page or the probe dies with
    // "__name is not defined". Same shim scripts/shot.ts installs, and for the
    // same reason — this must stay a string.
    await page.addInitScript({
      content: 'globalThis.__name = globalThis.__name || ((f) => f);',
    });
    const observations = await collect(page, mode);
    const result = evaluateHealth(observations);

    console.log(formatHealthReport(result, mode));

    // Contrast findings are `warn`, never fatal — and deliberately summarised
    // rather than listed. A full sweep produces ~240 of them, essentially all
    // in the light theme and essentially all false: the analyzer flags reIS's
    // green-on-green pills and its deliberately subtle card surfaces, which
    // look correct on screen (verified by screenshot, not assumed). Printing
    // that wall on every run is how a gate teaches everyone to ignore it.
    // Run `npm run verify:ui` when you actually want to look at contrast.
    const warns = Object.entries(observations.visual).flatMap(([where, fs]) =>
      fs.filter((f) => f.severity === 'warn').map((f) => ({ where, f }))
    );
    if (warns.length > 0) {
      const byTheme: Record<string, number> = {};
      for (const { where } of warns) {
        const theme = where.endsWith('light') ? 'light' : 'dark';
        byTheme[theme] = (byTheme[theme] ?? 0) + 1;
      }
      const summary = Object.entries(byTheme)
        .map(([t, n]) => `${n} ${t}`)
        .join(', ');
      console.log(`\n${warns.length} contrast warning(s) — not blocking (${summary} theme).`);
    }

    return result.ok ? 0 : 1;
  } finally {
    await browser?.close();
    await server?.close();
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('check:app crashed:', err);
    process.exit(1);
  });
