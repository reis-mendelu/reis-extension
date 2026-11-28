import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { bundleOptions } from '../snapshots/start.mjs';

// `import.meta.env` exists only where Vite or a bundler fills it in. Under plain
// tsx it is undefined, so one bare `import.meta.env.X` at module load kills the
// script: `npm run scrape:real` died right after login on
// `src/utils/school.ts` for weeks (the School profile refactor added the read),
// and with it the only way to get the real IS HTML a parser change needs.
// Nothing noticed, because the script runs only against live IS.
//
// These tests find that without logging in: they walk each script's import
// graph with esbuild and look at what is left of `import.meta.env`.

const scripts: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts;

const entriesOf = (pattern: RegExp): [script: string, entry: string][] =>
  Object.entries(scripts).flatMap(([name, command]) =>
    [...command.matchAll(pattern)].map((m): [string, string] => [name, m[1] ?? ''])
  );

const tsxRun = entriesOf(/\btsx (?:--tsconfig \S+ )?(\S+)/g);
const bundledRun = entriesOf(/\bnode scripts\/run-bundled\.mjs (\S+)/g);

const SENTINEL = '__BARE_IMPORT_META_ENV__';

/** The script's whole graph as one text, with `define` overridden. */
async function bundleText(entry: string, define: Record<string, string> | undefined) {
  const options = bundleOptions(resolve(entry), 'unused.mjs');
  const result = await build({
    ...options,
    define: define ?? options.define,
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles.map((f) => f.text).join('\n');
}

describe('scripts that run under plain tsx', () => {
  it('finds the tsx scripts in package.json', () => {
    expect(tsxRun.length).toBeGreaterThan(5);
  });

  // `import.meta.env?.X` is fine under tsx (it reads undefined); a bare
  // `import.meta.env.X` throws. A read inside a function the script never calls
  // would also trip this. That is deliberate: move the script to
  // `node scripts/run-bundled.mjs <entry>` rather than reason about which
  // reads are reached.
  it.each(tsxRun)(
    '%s reads no bare import.meta.env anywhere in its graph',
    async (_script, entry) => {
      const text = await bundleText(entry, { 'import.meta.env': SENTINEL });
      expect(text).not.toMatch(new RegExp(`${SENTINEL}(?!\\?\\.)`));
    },
    60_000
  );
});

describe('scripts that run from an esbuild bundle', () => {
  it('scrape:real is one of them', () => {
    expect(bundledRun).toContainEqual(['scrape:real', 'scripts/scrape-real-data.ts']);
  });

  it.each([
    ...bundledRun,
    ['snapshots', 'scripts/snapshots/run.ts'],
    ['personas:check', 'scripts/personas-check.ts'],
  ])(
    '%s bundles, and no import.meta.env is left in the bundle',
    async (_script, entry) => {
      const text = await bundleText(entry, undefined);
      expect(text.length).toBeGreaterThan(1000);
      // esbuild labels the object it puts in its place `<define:import.meta.env>`.
      expect(text).not.toMatch(/(?<!<define:)import\.meta\.env/);
    },
    60_000
  );

  it('run-bundled.mjs fills in import.meta.env, passes arguments on and returns the exit code', () => {
    const dir = mkdtempSync(join(tmpdir(), 'reis-run-bundled-'));
    const entry = join(dir, 'runBundledProbe.ts');
    writeFileSync(
      entry,
      'const school: string = import.meta.env.VITE_REIS_SCHOOL;\n' +
        "process.stdout.write([school, ...process.argv.slice(2)].join(' '));\n" +
        'process.exit(3);\n'
    );
    const run = spawnSync(process.execPath, ['scripts/run-bundled.mjs', entry, '--dump-html'], {
      encoding: 'utf8',
    });
    expect(run.stdout).toBe('mendelu --dump-html');
    expect(run.status).toBe(3);
  }, 60_000);

  it('run-bundled.mjs fails with a message when the entry cannot be bundled', () => {
    const run = spawnSync(process.execPath, ['scripts/run-bundled.mjs', 'scripts/no-such.ts'], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('run-bundled: bundling scripts/no-such.ts failed');
  }, 60_000);
});
