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
