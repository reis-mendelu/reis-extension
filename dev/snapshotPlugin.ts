import type { Plugin, ViteDevServer } from 'vite';
import { existsSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { snapshotAgeMs, isStale, maxAgeMsFromEnv, DAY_MS } from '../scripts/lib/snapshotFreshness';

const LOCK_TTL_MS = 10 * 60 * 1000; // assume a scrape older than this died

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

      const exists = existsSync(snapshotPath);
      let lastSync: number | undefined;
      let mtime: number | undefined;
      if (exists) {
        mtime = statSync(snapshotPath).mtimeMs;
        try {
          lastSync = JSON.parse(readFileSync(snapshotPath, 'utf8')).lastSync;
        } catch {
          /* unreadable/partial snapshot ⇒ treat age as unknown */
        }
      }
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

function hasCredentials(root: string): boolean {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return false;
  const env = readFileSync(envPath, 'utf8');
  return /^MENDELU_USER=.+/m.test(env) && /^MENDELU_PASS=.+/m.test(env);
}

function maybeRefresh(
  root: string,
  lockPath: string,
  log: (m: string) => void,
  server: ViteDevServer
): void {
  if (process.env.REIS_SNAPSHOT_NO_AUTOFETCH === '1') {
    log('auto-refresh disabled (REIS_SNAPSHOT_NO_AUTOFETCH=1) — run `npm run scrape:real` manually');
    return;
  }
  if (!hasCredentials(root)) {
    log('no MENDELU creds in .env — skipping auto-refresh (run `npm run scrape:real`)');
    return;
  }
  if (existsSync(lockPath) && Date.now() - statSync(lockPath).mtimeMs < LOCK_TTL_MS) {
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
}
