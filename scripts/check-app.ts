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

  return {
    requests,
    storeCounts,
    skeletonCount,
    textLength,
    outputFiles: readdirSync(OUT_DIR),
    mode,
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
    const observations = await collect(page, mode);
    const result = evaluateHealth(observations);

    console.log(formatHealthReport(result, mode));
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
