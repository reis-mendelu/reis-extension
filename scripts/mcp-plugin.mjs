// Assembles dist-plugin/reis, reIS for Claude as a Claude Code plugin, for the
// plugin directory. Run through `npm run mcp:plugin`, which builds the server
// first (vite.mcp.plugin.config.ts). Plain Node, so it runs the same on macOS,
// Linux and Windows.
//
// The folder is published as it is. It must hold exactly the files below:
// never public/ (the dev snapshot is a student's real IS data), never .env,
// never source maps. And every file must stay under the directory's 5 MiB
// limit, past which validation stops.
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = join('dist-plugin', 'reis');
const EXPECTED = [
  '.claude-plugin/plugin.json',
  'LICENSE',
  'README.md',
  'server/index.mjs',
  'skills/reading-is-files/SKILL.md',
];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const fail = (msg) => {
  console.error(`mcp:plugin: ${msg}`);
  process.exit(1);
};

cpSync(join('mcp', 'plugin'), OUT, { recursive: true });
// One version for both products: the .mcpb manifest's.
const { version } = JSON.parse(readFileSync(join('mcp', 'manifest.json'), 'utf8'));
const pluginJson = join(OUT, '.claude-plugin', 'plugin.json');
writeFileSync(
  pluginJson,
  JSON.stringify({ ...JSON.parse(readFileSync(pluginJson, 'utf8')), version }, null, 2) + '\n'
);

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
const files = listFiles(OUT);
const names = files.map((p) => relative(OUT, p).split(sep).join('/')).sort();
if (JSON.stringify(names) !== JSON.stringify(EXPECTED)) {
  fail(`unexpected plugin contents:\n${names.join('\n')}`);
}
for (const p of files) {
  if (statSync(p).size >= MAX_FILE_BYTES) fail(`${p} is over 5 MiB`);
}
console.log(`mcp:plugin: folder holds exactly ${EXPECTED.join(', ')}, each under 5 MiB`);

const bundle = readFileSync(join(OUT, 'server', 'index.mjs'), 'utf8');
if (/parseOffice|pdfjs-dist|GlobalWorkerOptions/.test(bundle)) {
  fail('the bundle contains officeparser or pdfjs; the plugin hands files over instead');
}
// reIS's own project host (src/services/supabase/config.ts) and the client
// library: a public suffix list inside a dependency names supabase.co itself.
if (/zvbpgkmnrqyprtkyxkwn|supabase-js|GoTrueClient/.test(bundle)) {
  fail('the bundle contains Supabase code');
}
console.log('mcp:plugin: no officeparser, pdfjs or Supabase code in the bundle');

// Claude Code starts the server with plain node. Start it with placeholder
// credentials (no tool is called, so nothing logs in) and fail if it dies.
const verdict = await new Promise((done) => {
  const child = spawn(process.execPath, [join(OUT, 'server', 'index.mjs')], {
    env: { ...process.env, MENDELU_USER: 'plugin-check', MENDELU_PASS: 'plugin-check' },
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => (stderr += d));
  const timer = setTimeout(() => {
    child.kill();
    done({ alive: true, stderr });
  }, 4000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    done({ alive: false, code, stderr });
  });
});
if (!verdict.alive) fail(`the server exits on start:\n${verdict.stderr.slice(0, 800)}`);
console.log('mcp:plugin: the server stays up under plain node');

// The directory's own schema check, where Claude Code is installed (not in CI).
try {
  execFileSync('claude', ['plugin', 'validate', OUT], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} catch (e) {
  if (e.code === 'ENOENT') console.log('mcp:plugin: claude CLI not found, skipped plugin validate');
  else fail('claude plugin validate failed');
}
