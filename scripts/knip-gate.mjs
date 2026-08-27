// Ratchet over knip's FULL report, not just unreferenced files.
//
// `lint:dead` runs `knip --include files`, which answers one question: is any
// file unreachable? Useful, and it is what caught 39 dead files — but it hides
// everything else knip found. Bare `npx knip` exits 1 with 128 unused exports,
// 121 unused exported types, 2 unused dependencies and 5 unused devDependencies.
// None of that was visible to CI.
//
// Turning it on as an absolute gate would land red, so it is a ratchet like the
// others: per-category counts that may fall and never rise. Unused exports are
// the surface area of a module — every one is a thing a future caller can bind
// to that nobody meant to expose — and unused dependencies are shipped weight
// plus supply-chain surface.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const BASELINE_FILE = 'knip-baseline.json';
const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));

let raw = '';
try {
  raw = execFileSync('npx', ['knip', '--reporter', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // knip exits non-zero whenever it finds anything; the JSON is still on stdout.
  raw = e.stdout ?? '';
  if (!raw) {
    console.error('knip produced no output:', e.message);
    process.exit(1);
  }
}

const report = JSON.parse(raw);
const issues = Array.isArray(report.issues) ? report.issues : [];

/** knip's json reporter groups every finding under a per-file record. */
const counts = {};
for (const entry of issues) {
  for (const [category, value] of Object.entries(entry)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    counts[category] = (counts[category] ?? 0) + value.length;
  }
}
counts.files = (report.files ?? []).length;

const categories = [...new Set([...Object.keys(counts), ...Object.keys(baseline.counts ?? {})])];
const rose = categories.filter((c) => (counts[c] ?? 0) > (baseline.counts?.[c] ?? 0));
const fell = categories.filter((c) => (counts[c] ?? 0) < (baseline.counts?.[c] ?? 0));

if (rose.length) {
  console.error('❌ knip regressed:');
  for (const c of rose) {
    console.error(`   ${c}: ${baseline.counts?.[c] ?? 0} -> ${counts[c] ?? 0}`);
  }
  console.error('\nRemove the new dead code, or export it only where it is used.');
  process.exit(1);
}

if (fell.length) {
  if (process.argv.includes('--write')) {
    writeFileSync(BASELINE_FILE, JSON.stringify({ ...baseline, counts }, null, 2) + '\n');
    console.log('✅ baseline banked:');
    for (const c of fell) console.log(`   ${c}: ${baseline.counts?.[c] ?? 0} -> ${counts[c] ?? 0}`);
    process.exit(0);
  }
  console.error('❌ knip improved — bank it so it cannot regress:');
  for (const c of fell) {
    console.error(`   ${c}: ${baseline.counts?.[c] ?? 0} -> ${counts[c] ?? 0}`);
  }
  console.error('\n  npm run lint:dead:full -- --write');
  process.exit(1);
}

const summary = categories
  .filter((c) => (counts[c] ?? 0) > 0)
  .map((c) => `${c} ${counts[c]}`)
  .join(', ');
console.log(`✅ knip ratchet ok — ${summary || 'nothing unused'}`);
