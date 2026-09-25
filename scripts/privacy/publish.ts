// npm run privacy:publish [-- --skip-gist] [-- --skip-play] [-- --ref <branch>]
//
// The two disclosure steps that have an API, run before the release PR merges:
//  1. the privacy-policy gist, republished from docs/privacy-policy-app.md and
//     read back. It is owned by ElijaahInverted, so gh is switched to that
//     account for the write and ALWAYS switched back (memory: privacy-policy-gist).
//  2. Play Data safety: dispatches .github/workflows/play-data-safety.yml, which
//     pushes privacy/play-data-safety.csv with the store's service account, and
//     waits for it.
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

const latestRun = (ref: string) =>
  run('gh', [
    'run',
    'list',
    '--workflow',
    'play-data-safety.yml',
    '--branch',
    ref,
    '--limit',
    '1',
    '--json',
    'databaseId',
    '--jq',
    '.[0].databaseId // ""',
  ]);

function publishPlay(): void {
  const ref = refArg ?? run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const before = latestRun(ref);
  run('gh', ['workflow', 'run', 'play-data-safety.yml', '--ref', ref]);
  // The run appears a moment after dispatch; wait for one newer than before.
  let id = '';
  for (let i = 0; i < 20 && (!id || id === before); i++) {
    execFileSync('sleep', ['3']);
    id = latestRun(ref);
  }
  if (!id || id === before) throw new Error('play-data-safety.yml run did not appear');
  execFileSync('gh', ['run', 'watch', id, '--exit-status'], { stdio: 'inherit' });
  console.log(
    `Play Data safety: pushed by run ${id}. Check Publishing overview for "Send for review".`
  );
}

// Both writes need ElijaahInverted: it owns the gist, and the work account is an
// EMU that cannot dispatch workflows on this repo. Always switched back.
const previous = run('gh', ['api', 'user', '--jq', '.login']);
try {
  run('gh', ['auth', 'switch', '--user', 'ElijaahInverted']);
  if (!has('--skip-gist')) publishGist();
  if (!has('--skip-play')) publishPlay();
} finally {
  if (previous && previous !== 'ElijaahInverted') run('gh', ['auth', 'switch', '--user', previous]);
}
