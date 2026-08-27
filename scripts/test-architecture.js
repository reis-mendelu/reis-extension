/**
 * Architecture gate: data hooks must not reach into the sync layer directly.
 * Only src/store and src/services may talk to it — see the Iron Rules in
 * CLAUDE.md ("NO useEffect for data fetching", "NO generic state").
 *
 * Ratcheted, like nuia-gate.mjs and lint-gate.mjs. The rule was written as
 * all-or-nothing, the codebase drifted past it, and because the script was wired
 * to no npm script and no CI job nobody found out: it exits 1 on main today. An
 * absolute gate that fails on the mainline is a gate that gets ignored.
 *
 * Two files are baselined. They post messages through the sync service
 * (triggerDriveBackup, triggerRefresh) rather than fetching data through it, so
 * they are a weaker violation than the rule was aimed at — but they ARE
 * violations, and they are recorded rather than excused. What this gate now
 * guarantees is that no NEW hook joins them.
 *
 * Delete the baseline entries as the hooks are refactored; delete the script when
 * the baseline is empty.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const HOOKS_DIR = path.resolve(ROOT, 'src/hooks');
const ILLEGAL_IMPORT = 'syncService';
const BASELINE_FILE = path.resolve(ROOT, 'architecture-baseline.json');

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
const allowed = new Set(baseline.hooksImportingSyncService ?? []);

console.log('🔍 Checking for illegal syncService imports in hooks...');

let output = '';
try {
  output = execSync(
    `grep -rl "${ILLEGAL_IMPORT}" ${HOOKS_DIR} --exclude-dir=__tests__ || true`
  ).toString();
} catch (error) {
  console.error('Error running architecture test:', error.message);
  process.exit(1);
}

const offenders = output
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((f) => path.relative(ROOT, f))
  .sort();

const fresh = offenders.filter((f) => !allowed.has(f));
const fixed = [...allowed].filter((f) => !offenders.includes(f));

if (fresh.length) {
  console.error('\n❌ Architectural violation: these hooks reach the sync layer directly.');
  for (const f of fresh) console.error(`  - ${f}`);
  console.error(
    '\nUse a store selector and move the work into a Zustand slice ' +
      '(CLAUDE.md → State & Storage).'
  );
  process.exit(1);
}

if (fixed.length) {
  console.error('\n❌ These hooks no longer violate the rule — remove them from the baseline:');
  for (const f of fixed) console.error(`  - ${f}`);
  console.error(`\n  ${path.relative(ROOT, BASELINE_FILE)}`);
  process.exit(1);
}

console.log(
  `✅ architecture ratchet ok — ${offenders.length} baselined hook(s), no new violations.`
);
