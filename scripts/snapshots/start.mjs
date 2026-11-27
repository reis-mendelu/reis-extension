#!/usr/bin/env node
/**
 * `npm run snapshots`: bundles run.ts with esbuild, then runs the bundle.
 *
 * Not plain tsx: the IS fetchers come from src/, which reads build-time values
 * (`import.meta.env.VITE_REIS_SCHOOL` in src/utils/school.ts) that only Vite or a
 * bundler fills in. Under tsx `import.meta.env` is undefined and the first live
 * run died on it (2026-11-27). The values below match the reIS for Claude build
 * (vite.mcp.config.ts: a production SSR build for MENDELU).
 *
 * The child's exit code is passed through, so launchd's wrapper sees 0, 3 or 4
 * from run.ts, and anything else (a failed bundle) as "did not start".
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const ENV = {
  MODE: 'production',
  DEV: false,
  PROD: true,
  SSR: true,
  BASE_URL: '/',
  VITE_REIS_SCHOOL: 'mendelu',
};

/** esbuild options for any entry that pulls in src/ under Node. */
export function bundleOptions(entry, outfile) {
  return {
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    tsconfig: resolve('tsconfig.app.json'),
    define: { 'import.meta.env': JSON.stringify(ENV) },
    logLevel: 'warning',
  };
}

const OUT = resolve('node_modules/.cache/reis-snapshots/run.mjs');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await build(bundleOptions(resolve('scripts/snapshots/run.ts'), OUT));
  } catch (err) {
    process.stderr.write(
      `snapshots: bundling failed: ${err instanceof Error ? err.message : err}\n`
    );
    process.exit(1);
  }
  const child = spawnSync(process.execPath, [OUT, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(child.status ?? 1);
}
