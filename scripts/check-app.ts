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

/** The widths the app claims to support. Same three `scripts/shot.ts` uses. */
const WIDTHS = [320, 390, 430];

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

  // Layout at every supported width, on the page that is already loaded and
  // settled — re-navigating would restart the boot and re-run the data load.
  const visual: Record<number, Finding[]> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });
    // Let the reflow finish before measuring; a rect read mid-transition
    // reports a position nothing was ever rendered at.
    await page.waitForTimeout(400);
    const probe = (await page.evaluate(probeSource)) as ProbeResult;
    visual[width] = analyzeProbe(probe);
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

    // Contrast findings are `warn` and never fail a PR, but they are the whole
    // reason someone would look, so they are printed either way.
    const warns = Object.entries(observations.visual).flatMap(([w, fs]) =>
      fs.filter((f) => f.severity === 'warn').map((f) => `  [warn ${f.kind} @${w}px] ${f.detail}`)
    );
    if (warns.length > 0) {
      console.log(`\n${warns.length} non-blocking layout warning(s):`);
      for (const line of warns.slice(0, 10)) console.log(line);
      if (warns.length > 10) console.log(`  … and ${warns.length - 10} more`);
    }
    if (!result.ok) {
      // The facts behind the verdict, so a CI log needs no second run.
      console.log(
        `\n  observed: ${Object.entries(observations.storeCounts)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${k}=${n}`)
          .join(' ')} | skeletons=${observations.skeletonCount} | text=${observations.textLength}`
      );
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
