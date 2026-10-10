// The .mcpb is a public download. It must contain exactly the manifest, the
// icon and the one server bundle: never public/ (the dev snapshot is a
// student's real IS data), never .env, never source maps.
import { execFileSync } from 'node:child_process';

const EXPECTED = ['icon.png', 'manifest.json', 'server/index.mjs'];
const listing = execFileSync('unzip', ['-Z1', 'dist-mcp/reis-for-claude.mcpb'], {
  encoding: 'utf8',
});
const files = listing.split('\n').filter(Boolean).sort();
if (JSON.stringify(files) !== JSON.stringify(EXPECTED)) {
  console.error(`mcp:pack: unexpected archive contents:\n${files.join('\n')}`);
  process.exit(1);
}
console.log(`mcp:pack: archive holds exactly ${EXPECTED.join(', ')}`);

// Claude Desktop's built-in Node host loads the entry with require(), which
// rejects an ES module graph containing a top-level await. Load it the same
// way with no credentials: it must reach the server's own "set your login"
// exit, not ERR_REQUIRE_ASYNC_MODULE.
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
