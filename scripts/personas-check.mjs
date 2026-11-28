#!/usr/bin/env node
/**
 * `npm run personas:check`: bundles personas-check.ts, then runs the bundle.
 *
 * Not plain tsx, for the reason `scripts/snapshots/start.mjs` gives: the IS
 * fetchers in src/ read `import.meta.env` (VITE_REIS_SCHOOL), which only a
 * bundler fills in. Same bundle options, so both live tools see one build.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { bundleOptions } from './snapshots/start.mjs';

const OUT = resolve('node_modules/.cache/reis-personas/check.mjs');
try {
  await build(bundleOptions(resolve('scripts/personas-check.ts'), OUT));
} catch (err) {
  process.stderr.write(
    `personas:check: bundling failed: ${err instanceof Error ? err.message : err}\n`
  );
  process.exit(1);
}
const child = spawnSync(process.execPath, [OUT, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(child.status ?? 1);
