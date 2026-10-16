// Checks the migrations a branch adds, against its base branch:
//
//   node scripts/db/lint-migrations.mjs [base-ref]     (default origin/test)
//
// The rules and why are in migrationLint.mjs and migrationFiles.mjs. Exits 1
// on any problem.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { lintSql, definedIn, stripSql, ALLOWABLE_RULES } from './migrationLint.mjs';
import { checkFileChanges } from './migrationFiles.mjs';

const DIR = 'supabase/migrations';
const base = process.argv[2] || process.env.MIGRATION_LINT_BASE || 'origin/test';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const read = (path) => readFileSync(path, 'utf8');

const changes = git('diff', '--name-status', `${base}...HEAD`, '--', DIR)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status = '', ...paths] = line.split('\t');
    return { status: status.charAt(0), path: paths[paths.length - 1] ?? '' };
  });
const baseFiles = git('ls-tree', '--name-only', `${base}:${DIR}`).split('\n').filter(Boolean);

/** What every migration except `path` defines: those objects are not new. */
const definedElsewhere = (path) => {
  const out = { tables: new Set(), functions: new Set() };
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.sql'))) {
    if (`${DIR}/${f}` === path) continue;
    const d = definedIn(stripSql(read(`${DIR}/${f}`)));
    d.tables.forEach((t) => out.tables.add(t));
    d.functions.forEach((fn) => out.functions.add(fn));
  }
  return out;
};

const problems = checkFileChanges(changes, baseFiles, read);
for (const { status, path } of changes) {
  // New files, and a failed file fixed in place (checkFileChanges vetted it).
  if (status !== 'A' && status !== 'M') continue;
  for (const f of lintSql(read(path), definedElsewhere(path))) {
    const how = f.allowable
      ? `If it is safe for every released build, add: -- migration-lint: allow ${f.rule}: <why>`
      : 'Remove it: the CLI already runs each file in one transaction.';
    problems.push(`${path}: [${f.rule}] ${f.statement}\n    ${how}`);
  }
}

if (changes.length === 0) console.log(`No migration changes against ${base}.`);
if (problems.length > 0) {
  for (const p of problems) {
    console.log(`::error::${p.split('\n')[0]}`);
    console.log(p);
  }
  console.log(`\n${problems.length} problem(s). Allowable rules: ${ALLOWABLE_RULES.join(', ')}.`);
  process.exit(1);
}
console.log(`Migrations OK against ${base} (${changes.length} changed).`);
