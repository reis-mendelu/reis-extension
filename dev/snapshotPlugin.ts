import type { Plugin, ViteDevServer } from 'vite';
import { readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { snapshotAgeMs, isStale, maxAgeMsFromEnv, DAY_MS } from '../scripts/lib/snapshotFreshness';
import { rebaseFixture, applyFixture } from '../scripts/lib/fixtureRebase';

const LOCK_TTL_MS = 10 * 60 * 1000; // assume a scrape older than this died

/** File mtime in ms, or undefined if the file is missing/unreadable. Attempts the
 *  stat directly (no existsSync-then-stat) to avoid a TOCTOU file-system race. */
function mtimeMs(path: string): number | undefined {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return undefined;
  }
}

/**
 * Dev-only Vite plugin for the standalone webapp: keeps rendering instant by
 * never blocking on the scraper, but auto-refreshes the real-data snapshot when
 * it is stale (>= REIS_SNAPSHOT_MAX_AGE_DAYS, default 7) or missing — running
 * `npm run scrape:real` in the background and live-reloading the page when the
 * fresh snapshot lands.
 */
export function reisSnapshotPlugin(): Plugin {
  const root = process.cwd();
  const snapshotPath = resolve(root, 'public/dev-real-data.json');
  const lockPath = resolve(root, 'public/.dev-real-data.lock');

  return {
    name: 'reis-snapshot-refresh',
    apply: 'serve',
    configureServer(server) {
      const log = (m: string) => server.config.logger.info(`\x1b[36m[reis-data]\x1b[0m ${m}`);
      const maxAge = maxAgeMsFromEnv(process.env);

      // REIS_FIXTURE=<name> serves dev/fixtures/<name>.json instead of (well,
      // overlaid on) the scraped snapshot. Exam data is seasonal — a July scrape
      // has no terms at all — so this is how the Exams screen gets populated
      // without hand-editing real data. Intercepting the request keeps the app
      // path identical: it still fetches /dev-real-data.json.
      const fixtureName = process.env.REIS_FIXTURE;
      if (fixtureName) {
        server.middlewares.use('/dev-real-data.json', (_req, res) => {
          const body = buildFixtureSnapshot(root, fixtureName, snapshotPath, log);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        });
        log(`serving fixture "${fixtureName}" — the real snapshot is untouched`);
        return; // no freshness check, no background scrape: a fixture is never stale
      }

      // Read stat + contents directly (try/catch), never existsSync-then-read,
      // so there is no file-system race between the check and the use.
      const mtime = mtimeMs(snapshotPath);
      let lastSync: number | undefined;
      if (mtime !== undefined) {
        try {
          lastSync = JSON.parse(readFileSync(snapshotPath, 'utf8')).lastSync;
        } catch {
          /* unreadable/partial snapshot ⇒ fall back to mtime */
        }
      }
      const exists = mtime !== undefined;
      const age = snapshotAgeMs(lastSync, mtime);
      const stale = isStale(age, maxAge);
      const ageLabel = age != null ? `${(age / DAY_MS).toFixed(1)}d old` : 'age unknown';
      log(exists ? `snapshot ${ageLabel} — ${stale ? 'stale' : 'fresh'}` : 'no snapshot yet');

      // Live-reload the page whenever the snapshot file changes (e.g. a
      // background or manual scrape rewrites it).
      server.watcher.add(snapshotPath);
      const onChange = (p: string) => {
        if (resolve(p) === snapshotPath) {
          log('snapshot updated — reloading page');
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('change', onChange);
      server.watcher.on('add', onChange);

      if (stale) maybeRefresh(root, lockPath, log, server);
    },
  };
}

/**
 * Rebase the named fixture onto today and overlay it on the real snapshot when
 * one exists, so synthetic exams sit alongside real subjects/files. Reads on
 * every request — editing the fixture just needs a page reload.
 */
function buildFixtureSnapshot(
  root: string,
  name: string,
  snapshotPath: string,
  log: (m: string) => void
): string {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  } catch {
    /* no real snapshot — the fixture stands alone */
  }
  const fixturePath = resolve(root, 'dev/fixtures', `${name}.json`);
  try {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    return JSON.stringify(applyFixture(base, rebaseFixture(fixture, new Date())));
  } catch (err) {
    log(`fixture "${name}" unreadable (${fixturePath}) — serving the real snapshot`);
    log(`  ${err instanceof Error ? err.message : String(err)}`);
    return JSON.stringify(base);
  }
}

function hasCredentials(root: string): boolean {
  let env: string;
  try {
    env = readFileSync(resolve(root, '.env'), 'utf8');
  } catch {
    return false;
  }
  return /^MENDELU_USER=.+/m.test(env) && /^MENDELU_PASS=.+/m.test(env);
}

function maybeRefresh(
  root: string,
  lockPath: string,
  log: (m: string) => void,
  server: ViteDevServer
): void {
  if (process.env.REIS_SNAPSHOT_NO_AUTOFETCH === '1') {
    log(
      'auto-refresh disabled (REIS_SNAPSHOT_NO_AUTOFETCH=1) — run `npm run scrape:real` manually'
    );
    return;
  }
  if (!hasCredentials(root)) {
    log('no MENDELU creds in .env — skipping auto-refresh (run `npm run scrape:real`)');
    return;
  }
  // Direct stat (no existsSync-then-stat race): a fresh lock means a scrape is
  // already running.
  const lockMtime = mtimeMs(lockPath);
  if (lockMtime !== undefined && Date.now() - lockMtime < LOCK_TTL_MS) {
    log('a refresh is already in progress — skipping');
    return;
  }

  writeFileSync(lockPath, String(process.pid));
  log('fetching fresh IS data in the background (npm run scrape:real)…');
  const child = spawn('npm', ['run', 'scrape:real'], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  child.on('exit', (code) => {
    try {
      rmSync(lockPath);
    } catch {
      /* lock already gone */
    }
    if (code === 0) {
      log('refresh complete — the page will reload with fresh data');
      server.ws.send({ type: 'full-reload' });
    } else {
      log(`refresh failed (exit ${code}) — keeping the existing snapshot`);
    }
  });

  // Without an 'error' listener a failed spawn (e.g. npm not on PATH) throws an
  // unhandled EventEmitter error that could take down the dev server, and the
  // lock would never be cleaned since 'exit' never fires.
  child.on('error', (err) => {
    try {
      rmSync(lockPath);
    } catch {
      /* lock already gone */
    }
    log(`refresh failed to start: ${err.message}`);
  });
}
