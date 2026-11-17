// npm run privacy:publish [-- --skip-gist] [-- --skip-play] [-- --gist-local] [-- --ref <branch>]
//
// The two disclosure steps that have an API, run before the release PR merges:
//  1. the privacy-policy gist, republished from docs/privacy-policy-app.md and
//     read back: dispatches .github/workflows/privacy-gist.yml (GIST_TOKEN) and
//     waits for it. --gist-local writes it from this machine's gh instead, the
//     way it was done before that workflow reached main.
//  2. Play Data safety: dispatches .github/workflows/play-data-safety.yml, which
//     pushes privacy/play-data-safety.csv with the store's service account, and
//     waits for it.
// Both workflows can also be dispatched by hand (Actions → Run workflow, ref
// `test`), which is how a cloud session runs them.
// Apple's label and the Chrome Web Store have no API; the release checklist says who does those.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GIST_ID, sameContent } from './gate';

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const refAt = args.indexOf('--ref');
const refArg = refAt === -1 ? undefined : args[refAt + 1];

const run = (cmd: string, a: string[]) =>
  execFileSync(cmd, a, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

function publishGist(): void {
  const policy = readFileSync('docs/privacy-policy-app.md', 'utf-8');
  const body = join(mkdtempSync(join(tmpdir(), 'reis-gist-')), 'g.json');
  writeFileSync(body, JSON.stringify({ files: { 'privacy.md': { content: policy } } }));
  run('gh', ['api', '-X', 'PATCH', `gists/${GIST_ID}`, '--input', body, '--jq', '.updated_at']);
  const live = run('gh', ['api', `gists/${GIST_ID}`, '--jq', '.files["privacy.md"].content']);
  if (!sameContent(live, policy)) throw new Error('gist read-back differs from the repo policy');
  console.log(`gist ${GIST_ID}: published and read back — matches docs/privacy-policy-app.md`);
}

const latestRun = (workflow: string, ref: string) =>
  run('gh', [
    'run',
    'list',
    '--workflow',
    workflow,
    '--branch',
    ref,
    '--limit',
    '1',
    '--json',
    'databaseId',
    '--jq',
    '.[0].databaseId // ""',
  ]);

/** Dispatches a workflow on the ref, waits for its run to finish, returns its id. */
function dispatchAndWatch(workflow: string): string {
  const ref = refArg ?? run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const before = latestRun(workflow, ref);
  run('gh', ['workflow', 'run', workflow, '--ref', ref]);
  // The run appears a moment after dispatch; wait for one newer than before.
  let id = '';
  for (let i = 0; i < 20 && (!id || id === before); i++) {
    execFileSync('sleep', ['3']);
    id = latestRun(workflow, ref);
  }
  if (!id || id === before) throw new Error(`${workflow} run did not appear`);
  execFileSync('gh', ['run', 'watch', id, '--exit-status'], { stdio: 'inherit' });
  return id;
}

function publishPlay(): void {
  const id = dispatchAndWatch('play-data-safety.yml');
  console.log(
    `Play Data safety: pushed by run ${id}. Check Publishing overview for "Send for review".`
  );
}

// Both writes need ElijaahInverted: it owns the gist, and the work account is an
// EMU that cannot dispatch workflows on this repo. Always switched back.
// The active account is read from gh's local config, not `gh api user`: the
// work account is often over its API rate limit, and that call then aborted the
// publish before the switch (release 5.3.0).
const previous = run('gh', ['config', 'get', '-h', 'github.com', 'user']);
try {
  run('gh', ['auth', 'switch', '--user', 'ElijaahInverted']);
  if (!has('--skip-gist')) {
    if (has('--gist-local')) publishGist();
    else console.log(`gist: published by run ${dispatchAndWatch('privacy-gist.yml')}`);
  }
  if (!has('--skip-play')) publishPlay();
} finally {
  if (previous && previous !== 'ElijaahInverted') run('gh', ['auth', 'switch', '--user', previous]);
}
