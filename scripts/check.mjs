#!/usr/bin/env node
// `npm run check` — will CI pass on what this branch changed?
//
// One command, in the order that makes each answer trustworthy:
//
//   install    node_modules matches package-lock.json (else nothing below means anything)
//   typecheck  tsc -b                      — CI: Typecheck
//   nuia       the noUncheckedIndexedAccess ratchet — CI: same job; the top avoidable red
//   lint       eslint --max-warnings=0 on the changed files — CI lints the repo
//   format     prettier --check on the changed files        — CI checks the repo
//   tests      vitest related <changed files> + every guard test
//
// "Changed" is everything that differs from the base this branch was cut from,
// committed or not. The LAST line is the verdict (`check: PASS …` / `check:
// FAIL …`) and the exit code agrees with it, so `| tail -1` cannot lie.
//
// What it does not run: the full suite, build:web, check:app and the e2e
// suites. Those are CI's (CLAUDE.md > "What to run locally").
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { closestBase, planFromChanges, verdict } from './lib/checkPlan.mjs';
import { describeInstall, ensureInstall } from './ensure-install.mjs';

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};
const bin = (name) => join('node_modules', '.bin', name);
const run = (command, args) =>
  spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;

const results = [];
const step = (name, ok, detail) => results.push({ step: name, ok, detail });
const header = (title) => console.log(`\n── ${title}`);
const finish = () => {
  const line = verdict(results);
  console.log(`\n${line}`);
  process.exit(line.startsWith('check: PASS') ? 0 : 1);
};

const [root] = git('rev-parse', '--show-toplevel');
if (root) process.chdir(root);

header('install');
const install = ensureInstall(process.cwd(), { install: true });
console.log(describeInstall(install) ?? 'install: node_modules matches package-lock.json');
step('install', install.status !== 'stale');
// A stale install fails typecheck and tests in ways that look like real bugs.
if (install.status === 'stale') finish();

// Local refs only: no fetch, so this works offline and never waits on a network.
const base = closestBase(
  ['origin/test', 'origin/main'].flatMap((ref) => {
    const [sha] = git('merge-base', 'HEAD', ref);
    if (!sha) return [];
    return [{ ref, sha, ahead: Number(git('rev-list', '--count', `${sha}..HEAD`)[0] ?? 0) }];
  })
);
const changed = [
  ...new Set([
    ...(base ? git('diff', '--name-only', '--diff-filter=ACMR', base.sha) : []),
    ...git('diff', '--name-only', '--diff-filter=ACMR', 'HEAD'),
    ...git('ls-files', '--others', '--exclude-standard'),
  ]),
].filter((file) => existsSync(file));

header('changes');
const behind = Number(git('rev-list', '--count', 'HEAD..origin/test')[0] ?? 0);
console.log(
  `${changed.length} changed file(s) against ${base ? base.ref : 'HEAD (no base found)'}` +
    (behind > 0 ? `; origin/test is ${behind} commit(s) ahead of this branch` : '')
);
if (base?.ref === 'origin/main')
  console.log(
    'note: this branch is cut from main. PRs go to test: merge origin/test in first (CLAUDE.md > Branches).'
  );

const guardDir = join('src', 'test', 'guards');
const alwaysRun = [
  ...(existsSync(guardDir) ? readdirSync(guardDir) : [])
    .filter((file) => /\.test\.tsx?$/.test(file))
    .map((file) => `${guardDir}/${file}`),
  'scripts/lib/__tests__/privacyDisclosures.test.ts',
].filter((file) => existsSync(file));
const plan = planFromChanges(changed, alwaysRun);
const files = (list) => `${list.length} file${list.length === 1 ? '' : 's'}`;

header('typecheck');
step('typecheck', run(bin('tsc'), ['-b']));

header('nuia');
step('nuia', run(process.execPath, ['scripts/nuia-gate.mjs']));

header('lint');
if (plan.lint.length === 0) console.log('no changed .ts/.tsx files');
step(
  'lint',
  plan.lint.length === 0 ||
    run(bin('eslint'), ['--max-warnings=0', '--no-warn-ignored', ...plan.lint]),
  files(plan.lint)
);

header('format');
step(
  'format',
  plan.format.length === 0 || run(bin('prettier'), ['--check', '--ignore-unknown', ...plan.format]),
  files(plan.format)
);

header('tests');
// Three workers: a dozen sessions share this Mac, and vitest's default of one
// worker per core is what makes their handshakes time out.
step(
  'tests',
  plan.tests.length > 0 &&
    run(bin('vitest'), ['related', '--run', '--maxWorkers=3', ...plan.tests]),
  `related to ${files(changed)} + ${alwaysRun.length} guards`
);

finish();
