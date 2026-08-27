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

const zero = Object.entries(summary)
  .filter(([k]) => k !== 'total')
  .filter(([, v]) => v.statements.total > 0 && v.statements.covered === 0)
  .map(([k]) => k.replace(cwd, ''))
  .sort();

const count = zero.length;

if (count > baseline.maxZeroCoverageFiles) {
  const known = new Set(baseline.knownFiles ?? []);
  const fresh = zero.filter((f) => !known.has(f));
  console.error(
    `❌ files with zero test coverage rose to ${count}; ` +
      `baseline allows ${baseline.maxZeroCoverageFiles}.`
  );
  if (fresh.length) {
    console.error('Newly untested:');
    for (const f of fresh) console.error(`   ${f}`);
  }
  console.error('\nAdd a test, or if the file is genuinely untestable, say why in the baseline.');
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

console.log(`✅ zero-coverage ratchet ok — ${count} files still untested`);
