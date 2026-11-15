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
import {
  closestBase,
  deletedStems,
  nulSeparated,
  planFromChanges,
  verdict,
} from './lib/checkPlan.mjs';
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
/** File lists from git, NUL-separated so a non-ASCII name arrives as it is on disk. */
const gitPaths = (command, ...args) => {
  try {
    return nulSeparated(
      execFileSync('git', [command, '-z', ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    );
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
  // exitCode, not process.exit(): exiting at once can cut off output that is
  // still on its way down a pipe, and the verdict is the line that must arrive.
  process.exitCode = line.startsWith('check: PASS') ? 0 : 1;
};

function main() {
  const [root] = git('rev-parse', '--show-toplevel');
  if (root) process.chdir(root);

  header('install');
  const install = ensureInstall(process.cwd(), { install: true });
  console.log(describeInstall(install) ?? 'install: node_modules matches package-lock.json');
  const installed = ['ok', 'copied', 'installed'].includes(install.status);
  step('install', installed);
  // A stale install fails typecheck and tests in ways that look like real bugs.
  if (!installed) return finish();

  // Local refs only: no fetch, so this works offline and never waits on a network.
  // `npm run check -- --base <ref>` names the base where neither is known.
  const baseArg = process.argv.indexOf('--base');
  const base = closestBase(
    (baseArg > 0 ? [process.argv[baseArg + 1]] : ['origin/test', 'origin/main']).flatMap((ref) => {
      const [sha] = ref ? git('merge-base', 'HEAD', ref) : [];
      if (!sha) return [];
      return [{ ref, sha, ahead: Number(git('rev-list', '--count', `${sha}..HEAD`)[0] ?? 0) }];
    })
  );

  header('changes');
  // Without a base only uncommitted files would be looked at, and a clean branch
  // would pass with none of its commits linted, formatted or tested.
  if (!base) {
    console.log(
      'Cannot tell what this branch changed: neither origin/test nor origin/main is known here.\n' +
        'Fetch one (git fetch origin test), or name the base: npm run check -- --base <ref>'
    );
    step('changes', false, 'no base');
    return finish();
  }

  const diff = (filter, ref, ...more) =>
    gitPaths('diff', '--name-only', `--diff-filter=${filter}`, ...more, ref);
  const changed = [
    ...new Set([
      ...diff('ACMR', base.sha),
      ...diff('ACMR', 'HEAD'),
      ...gitPaths('ls-files', '--others', '--exclude-standard'),
    ]),
  ].filter((file) => existsSync(file));
  // A rename counts as a deletion of the old path: its tests may still import it.
  const deleted = [
    ...new Set([...diff('D', base.sha, '--no-renames'), ...diff('D', 'HEAD', '--no-renames')]),
  ].filter((file) => !existsSync(file));
  const testsNamingDeleted = [
    ...new Set(
      deletedStems(deleted).flatMap((stem) =>
        gitPaths('grep', '-l', '-F', '-e', stem, '--', '*.test.ts', '*.test.tsx', '*.spec.ts')
      )
    ),
  ].filter((file) => existsSync(file));

  const behind = Number(git('rev-list', '--count', 'HEAD..origin/test')[0] ?? 0);
  console.log(
    `${changed.length} changed file(s) against ${base.ref}` +
      (deleted.length > 0
        ? `; ${deleted.length} deleted or renamed, named by ${testsNamingDeleted.length} test file(s)`
        : '') +
      (behind > 0 ? `; origin/test is ${behind} commit(s) ahead of this branch` : '')
  );
  if (base.ref === 'origin/main')
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
  const plan = planFromChanges(changed, alwaysRun, testsNamingDeleted);
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
    plan.format.length === 0 ||
      run(bin('prettier'), ['--check', '--ignore-unknown', ...plan.format]),
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
}

main();
