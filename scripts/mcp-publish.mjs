// Publishes reIS for Claude to reis-mendelu/reis-for-claude, when what it ships
// changed since the last release there. Run by the ship workflow (ship.yml, job
// "reIS for Claude") at every app release, so nobody bumps or releases it by
// hand. Both install routes take it from that one repository:
//   - Claude Desktop: the .mcpb of the "latest" release, the permanent link
//     https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb
//     The server's update notice (mcp/updateCheck.ts) compares against it.
//   - Claude Code: the plugin at the root of that repository's main branch.
//     Claude Code updates it once the student turns on auto-update.
//
// The version is the app's (package.json). "Changed" is the fingerprint of both
// outputs with the version left out (scripts/lib/mcpFingerprint.mjs), kept in
// the release notes. Unchanged means nothing is published, and that is success.
//
//   node scripts/mcp-publish.mjs [--no-build] [--dry-run] [--expect-version X.Y.Z]
//
// --no-build uses dist-mcp/ and dist-plugin/reis as they are: CI builds them in
// another job and hands over only the files, so no dependency code runs where
// the token is. Needs
// GH_TOKEN that can write to reis-for-claude (contents), e.g. locally
//   GH_TOKEN="$(gh auth token --user ElijaahInverted)" npm run mcp:release
// Order: plugin push first, release last. The release is the marker of a
// finished run, so a re-run after a failure picks up where it stopped.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fingerprintLine, mcpFingerprint, readFingerprint } from './lib/mcpFingerprint.mjs';
import { gitMetadataIn, isOlder, latestVersionOf, releaseNotes } from './lib/mcpPublishParts.mjs';

const REPO = 'reis-mendelu/reis-for-claude';
const MCPB = join('dist-mcp', 'reis-for-claude.mcpb');
const PLUGIN = join('dist-plugin', 'reis');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const expect = args.includes('--expect-version') ? args[args.indexOf('--expect-version') + 1] : '';

const say = (msg) => {
  console.log(`mcp:publish: ${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${msg}\n`);
};
const fail = (msg) => {
  console.error(`mcp:publish: ${msg}`);
  process.exit(1);
};
const run = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && cmd.endsWith('.cmd'),
    ...opts,
  });
  if (r.status !== 0) fail(`${cmd} ${argv[0]} ${argv[1] ?? ''} failed.`);
};
const gh = (argv) => spawnSync('gh', argv, { encoding: 'utf8' });

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (expect && expect !== version) fail(`package.json says ${version}, the tag says ${expect}.`);
const tag = `mcp-v${version}`;

if (!args.includes('--no-build')) {
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
    fail('the working tree has uncommitted changes. Publish only committed code.');
  run(npm, ['run', 'mcp:pack']);
  run(npm, ['run', 'mcp:plugin']);
}

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
const gitMeta = gitMetadataIn(listFiles(PLUGIN), PLUGIN);
if (gitMeta.length) fail(`the plugin build holds Git metadata, not publishing: ${gitMeta[0]}`);
const outputs = [
  ...['manifest.json', 'icon.png', join('server', 'index.mjs')].map((f) => [
    `mcpb/${f.split(sep).join('/')}`,
    join('dist-mcp', f),
  ]),
  ...listFiles(PLUGIN).map((p) => [`plugin/${relative(PLUGIN, p).split(sep).join('/')}`, p]),
];
const fp = mcpFingerprint(
  outputs.map(([path, p]) => ({ path, content: readFileSync(p) })),
  version
);
console.log(`mcp:publish: ${version}, fingerprint ${fp}`);

// The token must be able to push, or the real release fails halfway. Checked
// first, so every dry run proves it, changed or not.
const perm = gh(['api', `repos/${REPO}`, '--jq', '.permissions.push']);
if (perm.stdout.trim() !== 'true') fail(`the token cannot write to ${REPO}.`);

const same = gh(['release', 'view', tag, '--repo', REPO, '--json', 'body,isDraft,assets']);
if (same.status === 0) {
  const { body: sameBody, isDraft, assets } = JSON.parse(same.stdout);
  // A version is released once. Different contents under the same version
  // (a second local publish between app releases) must not pass silently.
  if (readFingerprint(sameBody) !== fp)
    fail(
      `${tag} is already released with different contents. This version cannot be republished; it ships with the next app version.`
    );
  if (isDraft) {
    // gh creates the release as a draft, uploads, then publishes: a draft is a
    // run that stopped halfway. Drop it and publish again below. A dry run
    // changes nothing, so it only says so.
    if (dryRun) {
      say(
        `reIS for Claude: ${tag} is an unfinished draft; would remove it and publish again (dry run).`
      );
    } else {
      run('gh', ['release', 'delete', tag, '--repo', REPO, '--yes']);
      say(`reIS for Claude: removed the unfinished draft of ${tag}.`);
    }
  } else if (!assets.some((a) => a.name === 'reis-for-claude.mcpb')) {
    if (dryRun) {
      say(`reIS for Claude: ${tag} lacks its .mcpb; would upload it (dry run).`);
    } else {
      run('gh', ['release', 'upload', tag, MCPB, '--repo', REPO]);
      say(`reIS for Claude: ${tag} was missing its .mcpb; uploaded.`);
    }
    process.exit(0);
  } else {
    say(`reIS for Claude: ${tag} is already released, nothing to do.`);
    process.exit(0);
  }
}
const latest = gh(['release', 'view', '--repo', REPO, '--json', 'tagName,body']);
if (latest.status !== 0) fail(`cannot read the latest release of ${REPO}:\n${latest.stderr}`);
const { tagName, body } = JSON.parse(latest.stdout);
if (readFingerprint(body) === fp) {
  say(`reIS for Claude: unchanged since ${tagName}, nothing published.`);
  process.exit(0);
}
// A re-run of an older app release must not put older code over a newer one,
// on main (what the plugin auto-updates from) or as the "latest" download.
const latestVersion = latestVersionOf(tagName);
if (latestVersion && isOlder(version, latestVersion))
  fail(
    `${tag} is older than the latest release ${tagName}; an older version is never published over a newer one.`
  );

if (dryRun) {
  say(
    `reIS for Claude: changed since ${tagName}; would release ${tag} (dry run, nothing published).`
  );
  process.exit(0);
}

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const from = `reis-mendelu/reis-extension@${commit}`;

// 1. The plugin: the repository root is the plugin, so it mirrors dist-plugin/reis.
const clone = mkdtempSync(join(tmpdir(), 'reis-for-claude-'));
// The clone's .git/config holds the token in its remote URL. fail() exits the
// process, which skips a finally block; an exit handler still runs.
process.on('exit', () => rmSync(clone, { recursive: true, force: true }));
const url = `https://x-access-token:${process.env.GH_TOKEN}@github.com/${REPO}.git`;
run('git', ['clone', '--quiet', '--depth', '1', url, clone]);
for (const name of readdirSync(clone)) {
  if (name !== '.git') rmSync(join(clone, name), { recursive: true, force: true });
}
cpSync(PLUGIN, clone, { recursive: true });
const git = (...a) => run('git', ['-C', clone, ...a]);
git('add', '--all');
const staged = spawnSync('git', ['-C', clone, 'diff', '--cached', '--quiet']);
if (staged.status === 1) {
  git(
    '-c',
    'user.name=reIS release',
    '-c',
    'user.email=reis.mendelu@gmail.com',
    'commit',
    '--quiet',
    '-m',
    `reIS for Claude ${version}\n\nFrom ${from}.`
  );
  git('push', '--quiet', 'origin', 'HEAD:main');
  say(`reIS for Claude: plugin ${version} pushed to ${REPO}.`);
} else {
  say('reIS for Claude: plugin files already up to date.');
}

// 2. The release: the .mcpb students download, and the fingerprint for next time.
const notes = releaseNotes({ version, from, fingerprintLine: fingerprintLine(fp) });
run('gh', [
  'release',
  'create',
  tag,
  MCPB,
  '--repo',
  REPO,
  '--title',
  `reIS for Claude ${version}`,
  '--notes',
  notes,
  '--latest',
]);
say(`reIS for Claude: released ${tag}.`);
