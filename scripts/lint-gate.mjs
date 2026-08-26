// Ratchet gate for the repo-wide eslint backlog, in the same spirit as
// nuia-gate.mjs: the counts may fall, never rise, and a drop must be banked by
// lowering the baseline in the same PR.
//
// The existing `ui-gate` CI job lints only files changed in the PR, with
// --max-warnings=0. That keeps new code clean but is blind to the backlog in
// everything untouched, and a PR that edits only tests lints nothing at all and
// still reports green. This job covers the whole repo.
//
// Errors and warnings are tracked SEPARATELY and deliberately. A single combined
// total makes severities fungible: with one scalar at 50, adding three fresh
// errors to a tree sitting at 47 lands exactly on the baseline and the gate goes
// green -- it rewards adding errors. Two counters make that impossible, because
// new errors always breach maxErrors whatever the warnings do.
//
// Delete this script and its baseline once both counts reach zero.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE_FILE = 'lint-baseline.json';
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

let raw = '';
try {
  raw = execFileSync('npx', ['eslint', '.', '--format', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // eslint exits non-zero whenever there are errors; the JSON is still on stdout.
  raw = e.stdout ?? '';
  if (!raw) {
    console.error('eslint produced no output:', e.message);
    process.exit(1);
  }
}

const results = JSON.parse(raw);
const errors = results.reduce((n, f) => n + f.errorCount, 0);
const warnings = results.reduce((n, f) => n + f.warningCount, 0);

const worst = results
  .filter((f) => f.errorCount + f.warningCount > 0)
  .sort((a, b) => b.errorCount + b.warningCount - (a.errorCount + a.warningCount))
  .slice(0, 5)
  .map(
    (f) =>
      `   ${f.filePath.replace(process.cwd() + '/', '')} ` + `(${f.errorCount}E ${f.warningCount}W)`
  );

const rose = errors > baseline.maxErrors || warnings > baseline.maxWarnings;
const fell = errors < baseline.maxErrors || warnings < baseline.maxWarnings;

if (rose) {
  console.error(
    `❌ eslint regressed: ${errors} errors / ${warnings} warnings; ` +
      `baseline allows ${baseline.maxErrors} / ${baseline.maxWarnings}.`
  );
  if (worst.length) console.error('Worst offenders:\n' + worst.join('\n'));
  process.exit(1);
}

if (fell) {
  if (process.argv.includes('--write')) {
    writeFileSync(
      BASELINE_FILE,
      JSON.stringify({ ...baseline, maxErrors: errors, maxWarnings: warnings }, null, 2) + '\n'
    );
    console.log(
      `✅ baseline banked: errors ${baseline.maxErrors} → ${errors}, ` +
        `warnings ${baseline.maxWarnings} → ${warnings}`
    );
    process.exit(0);
  }
  console.error(
    `❌ eslint improved to ${errors} errors / ${warnings} warnings ` +
      `(baseline ${baseline.maxErrors} / ${baseline.maxWarnings}). ` +
      `Bank it so it cannot regress: npm run lint:gate -- --write`
  );
  process.exit(1);
}

console.log(`✅ lint ratchet ok — ${errors} errors, ${warnings} warnings`);
