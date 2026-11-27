#!/usr/bin/env node
/**
 * `node scripts/run-bundled.mjs <entry> [args…]`: bundles a script with esbuild,
 * then runs the bundle with the arguments that follow.
 *
 * For a script that pulls in src/ and so cannot run under plain tsx: src/ reads
 * build-time values (`import.meta.env.VITE_REIS_SCHOOL` in src/utils/school.ts)
 * that only Vite or a bundler fills in. `npm run scrape:real` ran under tsx and
 * died on that read right after login. The options and the values are the
 * snapshots tool's (`bundleOptions` in scripts/snapshots/start.mjs), so there is
 * one place that says what `import.meta.env` is under Node.
 *
 * scripts/__tests__/nodeScriptsImportMetaEnv.test.ts fails when a script still
 * run with tsx reaches such a read; the fix is to run it through here.
 *
 * The child's exit code is passed through.
 */
import { spawnSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { build } from 'esbuild';
import { bundleOptions } from './snapshots/start.mjs';

const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  process.stderr.write('usage: node scripts/run-bundled.mjs <entry> [args…]\n');
  process.exit(1);
}

const out = resolve(
  'node_modules/.cache/reis-bundled',
  basename(entry).replace(/\.[cm]?[jt]s$/, '.mjs')
);

try {
  await build(bundleOptions(resolve(entry), out));
} catch (err) {
  process.stderr.write(
    `run-bundled: bundling ${entry} failed: ${err instanceof Error ? err.message : err}\n`
  );
  process.exit(1);
}
const child = spawnSync(process.execPath, [out, ...args], { stdio: 'inherit' });
process.exit(child.status ?? 1);
