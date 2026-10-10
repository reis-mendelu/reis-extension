// Builds dist-mcp/reis-for-claude.mcpb. Plain Node, so it runs the same on
// macOS, Linux and Windows (no cp, no unzip).
//
// The .mcpb is a public download. It must contain exactly the manifest, the
// icon and the one server bundle: never public/ (the dev snapshot is a
// student's real IS data), never .env, never source maps. And Claude Desktop's
// built-in Node host loads the entry with require(), which rejects an ES module
// graph containing a top-level await, so the bundle is loaded that way too.
import { execFileSync } from 'node:child_process';
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
    console.error(`mcp:pack: unexpected archive contents:\n${files.join('\n')}`);
    process.exit(1);
  }
} finally {
  rmSync(unpacked, { recursive: true, force: true });
}
console.log(`mcp:pack: archive holds exactly ${EXPECTED.join(', ')}`);

let stderr = '';
try {
  execFileSync(process.execPath, ['-e', "require('./dist-mcp/server/index.mjs')"], {
    env: { ...process.env, MENDELU_USER: '', MENDELU_PASS: '' },
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
  });
} catch (e) {
  stderr = String(e.stderr ?? '');
}
if (!stderr.includes('set your IS Mendelu username')) {
  console.error(`mcp:pack: the bundle cannot be loaded with require():\n${stderr.slice(0, 800)}`);
  process.exit(1);
}
console.log('mcp:pack: the bundle loads with require(), as Claude Desktop loads it');

// The promise "nothing goes to reIS" checked on what ships: the source graph
// reaches Supabase code the server never calls, and this proves the bundler
// dropped it.
const bundle = readFileSync(join('dist-mcp', 'server', 'index.mjs'), 'utf8');
if (/supabase\.co|supabase-js|GoTrueClient/.test(bundle)) {
  console.error('mcp:pack: the bundle contains Supabase code');
  process.exit(1);
}
console.log('mcp:pack: no Supabase code in the bundle');
