// npm run mcp:release — publishes reIS for Claude as a GitHub release of
// reis-mendelu/reis-for-claude. That repository's "latest" release is the
// permanent one-click link students get, and what the server's update notice
// (mcp/updateCheck.ts) compares against:
//   https://github.com/reis-mendelu/reis-for-claude/releases/latest/download/reis-for-claude.mcpb
// The version is the manifest's; bump mcp/manifest.json first.
// Needs a gh login that can write to that repository, e.g.
//   GH_TOKEN="$(gh auth token --user ElijaahInverted)" npm run mcp:release
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = 'reis-mendelu/reis-for-claude';
const ASSET = join('dist-mcp', 'reis-for-claude.mcpb');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const fail = (msg) => {
  process.stderr.write(`mcp:release: ${msg}\n`);
  process.exit(1);
};
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && cmd.endsWith('.cmd'),
  });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} failed.`);
};

const { version } = JSON.parse(readFileSync(join('mcp', 'manifest.json'), 'utf8'));
const tag = `mcp-v${version}`;

if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
  fail('the working tree has uncommitted changes. Release only committed code.');

const exists = spawnSync('gh', ['release', 'view', tag, '--repo', REPO], { stdio: 'ignore' });
if (exists.status === 0) fail(`${tag} is already released in ${REPO}. Bump mcp/manifest.json.`);

run(npm, ['run', 'mcp:pack']);

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const notes = [
  `reIS for Claude ${version} pro Claude Desktop.`,
  '',
  'Stáhni `reis-for-claude.mcpb`, otevři ho dvojklikem a v Claude Desktop klikni na Install. Návod: https://reisapp.cz/navody/reis-v-claude',
  '',
  'Download `reis-for-claude.mcpb`, double-click it and press Install in Claude Desktop. Guide: https://reisapp.cz/navody/reis-v-claude',
  '',
  `Built from reis-mendelu/reis-extension@${commit}.`,
].join('\n');

run('gh', [
  'release',
  'create',
  tag,
  ASSET,
  '--repo',
  REPO,
  '--title',
  `reIS for Claude ${version}`,
  '--notes',
  notes,
  '--latest',
]);
