// The /release preflight for the two traps that each cost a manual detour after
// the 5.7.2 merge (2026-11-15). Read-only: it fetches main and test and reads
// App Store Connect, and changes nothing anywhere.
//
//   npm run release:preflight -- --version 5.7.3 [--skip-ios] [--remote origin]
//
// 1. main/test drift: would the release PR test -> main conflict?
// 2. iOS: is another App Store version still waiting for / in review, or
//    otherwise editable? Then ship.yml would upload the build and stop.
//
// Exit 0 = nothing found. Exit 1 = a finding (or a check that could not run).
// What to do about each: docs/release-preflight.md.
import { config as loadDotenv } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ascHttp, resolveAscCredentials } from '../lib/ascApi';
import { describeBlocker, iosBlockers } from '../lib/iosPreflight';
import { checkDrift } from '../lib/releaseDrift';

loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });

const APP_ID = process.env.REIS_ASC_APP_ID ?? '6804832714';
const DOC = 'docs/release-preflight.md';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function driftFindings(remote: string): string[] {
  // Explicit destinations: a remote whose fetch config maps only some branches
  // would otherwise leave a stale origin/test behind and read as a false PASS.
  const refspecs = ['main', 'test'].map((b) => `+refs/heads/${b}:refs/remotes/${remote}/${b}`);
  const fetched = spawnSync('git', ['fetch', '--quiet', remote, ...refspecs], {
    encoding: 'utf8',
  });
  if (fetched.status !== 0) throw new Error(`git fetch ${remote}: ${fetched.stderr.trim()}`);
  const main = `${remote}/main`;
  const test = `${remote}/test`;
  const drift = checkDrift(main, test);
  if (!drift.conflicts.length && !drift.mainAheadOfBase) {
    console.log(`ok   main/test: main adds nothing beyond test, the release PR merges cleanly`);
    return [];
  }
  const what = drift.conflicts.length
    ? `the release PR would conflict in\n${drift.conflicts.map((f) => `       ${f}`).join('\n')}`
    : `main changes files beyond its merge base with test (a squashed release?).\n` +
      `       No conflict yet, but the version bump on test will conflict with it.`;
  const how = drift.mainTreeInTest
    ? `main's tree is in test's history, so main holds nothing test lacks:\n` +
      `       sync with \`git merge -s ours ${main}\` on a branch off test (lossless).`
    : `main's tree is NOT in test's history: main holds something test lacks.\n` +
      `       Look at \`git diff ${test} ${main}\` before syncing; do not take --ours blindly.`;
  return [`main/test drift: ${what}\n       ${how}`];
}

/** What to do, per state; recipes in the doc. Every one needs Dominik's OK. */
function remedy(state: string): string {
  if (state === 'WAITING_FOR_REVIEW' || state === 'IN_REVIEW')
    return 'ship.yml would upload the build and stop at the submit. Wait, or withdraw (needs Dominik).';
  if (state.startsWith('PENDING_'))
    return 'Approved but not out: Apple makes no new version until it is released.';
  return 'Not in review: rename that record to the new version (needs Dominik).';
}

async function iosFindings(version: string | undefined): Promise<string[]> {
  const blockers = await iosBlockers(ascHttp(resolveAscCredentials()), APP_ID, version);
  if (!blockers.length) {
    console.log('ok   App Store: no other iOS version is in review or editable');
    return [];
  }
  return blockers.map((b) => `App Store: ${describeBlocker(b)}.\n       ${remedy(b.state)}`);
}

async function main(): Promise<void> {
  const version = arg('--version');
  const remote = arg('--remote') ?? 'origin';
  const findings: string[] = [];
  const failed: string[] = [];

  try {
    findings.push(...driftFindings(remote));
  } catch (err) {
    failed.push(`main/test drift check: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (process.argv.includes('--skip-ios')) {
    console.log('skip App Store check (--skip-ios)');
  } else {
    if (!version) console.log('note --version not given: every editable iOS version is reported');
    try {
      findings.push(...(await iosFindings(version)));
    } catch (err) {
      failed.push(`App Store check: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const f of findings) console.log(`FIND ${f}`);
  for (const f of failed) console.log(`FAIL ${f}`);
  if (findings.length || failed.length) {
    console.log(
      `\npreflight: ${findings.length} finding(s), ${failed.length} failed check(s). See ${DOC}.`
    );
    process.exit(1);
  }
  console.log('\npreflight: PASS');
}

void main();
