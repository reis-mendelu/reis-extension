// Builds dist-mcp/reis-for-claude.mcpb. Plain Node, so it runs the same on
// macOS, Linux and Windows (no cp, no unzip).
//
// The .mcpb is a public download. It must contain exactly the manifest, the
// icon and the one server bundle: never public/ (the dev snapshot is a
// student's real IS data), never .env, never source maps. And the bundle must
// load the way Claude Desktop loads it (see below).
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';

const MCPB = ['-y', '@anthropic-ai/mcpb@2.1.2'];
const OUT = join('dist-mcp', 'reis-for-claude.mcpb');
const EXPECTED = ['icon.png', 'manifest.json', 'server/index.mjs'];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });

copyFileSync(join('mcp', 'manifest.json'), join('dist-mcp', 'manifest.json'));
copyFileSync(join('public', 'brand-assets', 'reIS_logo_512.png'), join('dist-mcp', 'icon.png'));
rmSync(OUT, { force: true });
run(npx, [...MCPB, 'validate', join('dist-mcp', 'manifest.json')]);
run(npx, [...MCPB, 'pack', 'dist-mcp', OUT]);

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
const unpacked = mkdtempSync(join(tmpdir(), 'reis-mcpb-'));
try {
  run(npx, [...MCPB, 'unpack', OUT, unpacked]);
  const files = listFiles(unpacked)
    .map((p) => relative(unpacked, p).split(sep).join('/'))
    .sort();
  if (JSON.stringify(files) !== JSON.stringify(EXPECTED)) {
    // Thrown, not process.exit(): the finally below must delete the unpacked
    // copy, which may hold exactly the data that must not ship.
    throw new Error(`mcp:pack: unexpected archive contents:\n${files.join('\n')}`);
  }
} finally {
  rmSync(unpacked, { recursive: true, force: true });
}
console.log(`mcp:pack: archive holds exactly ${EXPECTED.join(', ')}`);

// Claude Desktop runs the server inside its "MCP Node Host" in an Electron
// utility process and loads it with import(). There process.type is 'utility'
// and process.versions.electron is set, so libraries that sniff for Node
// (pdfjs) take their browser path: that is how 0.1.0-0.1.2 died with
// "DOMMatrix is not defined" while every plain-node run passed. The failure
// comes from a lazily evaluated module, moments after start, so the server has
// to stay up: start it in that environment with placeholder credentials (no
// tool is called, so nothing logs in) and fail on anything the host would
// treat as fatal within a few seconds.
const hostLike = `
  Object.defineProperty(process, 'type', { value: 'utility' });
  Object.defineProperty(process.versions, 'electron', { value: '38.0.0', enumerable: true });
  const fatal = (kind) => (e) => { process.stderr.write('[host] ' + kind + ': ' + (e && e.message) + '\\n'); process.exit(3); };
  process.on('uncaughtException', fatal('uncaughtException'));
  process.on('unhandledRejection', fatal('unhandledRejection'));
  import(require('node:url').pathToFileURL(require('node:path').resolve('dist-mcp/server/index.mjs')).href)
    .catch(fatal('import-failed'));
`;
const verdict = await new Promise((done) => {
  const child = spawn(process.execPath, ['-e', hostLike], {
    env: { ...process.env, MENDELU_USER: 'pack-check', MENDELU_PASS: 'pack-check' },
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
if (!verdict.alive || /\[host\]/.test(verdict.stderr)) {
  console.error(
    `mcp:pack: the server dies where Claude Desktop runs it:\n${verdict.stderr.slice(0, 800)}`
  );
  process.exit(1);
}
console.log('mcp:pack: the server stays up in a Claude-Desktop-like utility process');

// The promise "nothing goes to reIS" checked on what ships: the source graph
// reaches Supabase code the server never calls, and this proves the bundler
// dropped it.
const bundle = readFileSync(join('dist-mcp', 'server', 'index.mjs'), 'utf8');
if (/supabase\.co|supabase-js|GoTrueClient/.test(bundle)) {
  console.error('mcp:pack: the bundle contains Supabase code');
  process.exit(1);
}
console.log('mcp:pack: no Supabase code in the bundle');
