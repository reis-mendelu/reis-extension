// Ratchet gate for the noUncheckedIndexedAccess migration.
// Runs tsc WITH the flag, compares the set of erroring files against
// nuia-baseline.json, and fails if new files error OR a baselined file is
// already clean (forcing the baseline to shrink). Delete this script and the
// baseline in the final task once the real flag is flipped on.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const baseline = new Set(JSON.parse(readFileSync('nuia-baseline.json', 'utf8')));

let out = '';
try {
  execSync('npx tsc -p tsconfig.app.json --noUncheckedIndexedAccess --noEmit', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
}

// tsc line format: "src/api/foo.ts(12,5): error TS2532: ..."
const erroring = new Set();
for (const line of out.split('\n')) {
  const m = line.match(/^([^(]+\.tsx?)\(\d+,\d+\): error TS/);
  if (m) erroring.add(m[1].replaceAll('\\', '/'));
}

const newErrors = [...erroring].filter((f) => !baseline.has(f)).sort();
const staleBaseline = [...baseline].filter((f) => !erroring.has(f)).sort();

if (newErrors.length) {
  console.error('❌ NEW noUncheckedIndexedAccess errors (not in baseline) — fix them:');
  for (const f of newErrors) console.error(`   ${f}`);
}
if (staleBaseline.length) {
  console.error('❌ Baseline entries that are now clean — REMOVE them from nuia-baseline.json:');
  for (const f of staleBaseline) console.error(`   ${f}`);
}
if (newErrors.length || staleBaseline.length) process.exit(1);

console.log(`✅ nuia ratchet ok — ${erroring.size} files still in baseline`);
