// Ratchets the NUMBER OF FILES with zero covered statements.
//
// A global percentage floor cannot see a new untested file. With ~44k measured
// statements, a brand-new 0%-covered module of a few hundred statements moves the
// headline number by a fraction of a point and merges green -- which is exactly
// how a codebase accumulates 50 files that no test has ever executed.
//
// A `perFile` threshold would be the textbook answer, but it cannot be adopted
// here: 50 files are already at zero, so turning it on fails instantly and the
// only way to green is to delete the gate. Ratcheting the COUNT gets the property
// that matters -- untested files may only decrease -- and can be adopted today.
//
// Reads coverage/coverage-summary.json, so it must run after a coverage run that
// emits the json-summary reporter.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SUMMARY = 'coverage/coverage-summary.json';
const BASELINE_FILE = 'zero-coverage-baseline.json';

if (!existsSync(SUMMARY)) {
  console.error(
    `${SUMMARY} not found. Run coverage with the json-summary reporter first:\n` +
      `  npx vitest run --coverage --coverage.reporter=json-summary`
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
const cwd = process.cwd() + '/';

// Zero FUNCTIONS executed, not zero statements.
//
// Counting statements undercounted by 4x: 139 files had a module-level statement
// touched by a transitive import — an import binding, a `const` at top level —
// while not one of their functions had ever run. src/api/claude.ts read 2/72
// statements and 0/2 functions, and was invisible to this gate. A file whose
// functions have never executed is untested however many of its lines a bare
// import happened to evaluate.
//
// Files with no functions at all (pure data, type-only) are excluded: there is
// nothing there to execute.
const zero = Object.entries(summary)
  .filter(([k]) => k !== 'total')
  .filter(([, v]) => v.functions.total > 0 && v.functions.covered === 0)
  .map(([k]) => k.replace(cwd, ''))
  .sort();

const count = zero.length;
const known = new Set(baseline.knownFiles ?? []);
const fresh = zero.filter((f) => !known.has(f));

// Compare the SET, not just the count. Counting alone lets a SWAP through: cover
// one baselined file, add a brand-new untested module, and the total is
// unchanged — the gate says ok, and knownFiles quietly goes stale so the
// "newly untested" diagnostic never fires again. Any file that is untested and
// was not untested before is a regression regardless of what the total did.
if (fresh.length) {
  console.error(
    `❌ ${fresh.length} file(s) with zero test coverage are new since the baseline ` +
      `(total ${count}, baseline ${baseline.maxZeroCoverageFiles}):`
  );
  for (const f of fresh) console.error(`   ${f}`);
  console.error('\nAdd a test, or if the file is genuinely untestable, say why in the baseline.');
  process.exit(1);
}

if (count > baseline.maxZeroCoverageFiles) {
  console.error(
    `❌ files with zero test coverage rose to ${count}; ` +
      `baseline allows ${baseline.maxZeroCoverageFiles}.`
  );
  process.exit(1);
}

if (count < baseline.maxZeroCoverageFiles) {
  if (process.argv.includes('--write')) {
    writeFileSync(
      BASELINE_FILE,
      JSON.stringify({ ...baseline, maxZeroCoverageFiles: count, knownFiles: zero }, null, 2) + '\n'
    );
    console.log(`✅ baseline banked: ${baseline.maxZeroCoverageFiles} → ${count}`);
    process.exit(0);
  }
  console.error(
    `❌ zero-coverage files dropped to ${count} (baseline ${baseline.maxZeroCoverageFiles}). ` +
      `Bank it so it cannot regress: npm run coverage:zero-gate -- --write`
  );
  process.exit(1);
}

// Every per-area threshold glob in vitest.config.ts must match at least one
// MEASURED file. vitest silently ignores a glob that matches nothing, so a typo
// ('src/entrypoint/**' for 'src/entrypoints/**') turns a strict 90%-floor into a
// gate that can never fail, with no warning anywhere.
const config = readFileSync('vitest.config.ts', 'utf8');
const thresholdBlock = config.slice(config.indexOf('thresholds: {'));
// Every quoted KEY that opens an object, wildcard or not. An earlier revision
// required a '*', so a literal path key ('src/entrypoints/gone.ts') was never
// validated and its threshold silently applied to nothing.
const globs = [...thresholdBlock.matchAll(/'([^']+)':\s*\{/g)].map((m) => m[1]);
const measured = Object.keys(summary)
  .filter((k) => k !== 'total')
  .map((k) => k.replace(cwd, ''));

const toRegExp = (glob) =>
  new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '(?:.*/)?')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*') +
      '$'
  );

const deadGlobs = globs.filter((g) => !measured.some((f) => toRegExp(g).test(f)));
if (deadGlobs.length) {
  console.error('❌ coverage threshold glob(s) match no measured file — the gate cannot fail:');
  for (const g of deadGlobs) console.error(`   '${g}'`);
  console.error('\nFix the pattern, or drop the threshold if the area is gone.');
  process.exit(1);
}

console.log(
  `✅ zero-coverage ratchet ok — ${count} files still untested; ` +
    `${globs.length} threshold glob(s) all match measured files`
);
