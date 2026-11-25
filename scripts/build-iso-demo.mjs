// Builds the isometric map as a standalone static site in dist-iso-demo/, ready to hand to a static host:
//   npm run build:iso-demo            (tiles from ~/izomapa-brno/site/tiles_small_theme)
//   npm run build:iso-demo -- <tiles folder>
// Summer only (the one season the shipped code ever asks for); the tiles live outside this repo.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const arg = process.argv[2] ?? join(homedir(), 'izomapa-brno', 'site', 'tiles_small_theme');
const tiles = resolve(arg.startsWith('~') ? join(homedir(), arg.slice(1)) : arg);
if (!existsSync(join(tiles, 'summer', 'info.json')) && !existsSync(join(tiles, 'summer', '0'))) {
  console.error(`No summer tiles in ${tiles}`);
  process.exit(1);
}

execFileSync('npx', ['vite', 'build', '--config', 'vite.isoDemo.config.ts'], {
  cwd: root,
  stdio: 'inherit',
  // The preview flag is what puts the page in demo mode (no install count, no counters); /tiles is
  // where the copy below puts the pyramid, relative to the page.
  env: { ...process.env, VITE_PREVIEW_BUILD: 'true', VITE_ISO_MAP_URL: '/tiles' },
});

const out = join(root, 'dist-iso-demo');
rmSync(join(out, 'tiles'), { recursive: true, force: true });
cpSync(join(tiles, 'summer'), join(out, 'tiles', 'summer'), {
  recursive: true,
  filter: (src) => !src.endsWith('.DS_Store') && !src.endsWith('info.json'),
});
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(
  join(out, 'vercel.json'),
  JSON.stringify(
    {
      headers: [
        { source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
        {
          source: '/tiles/(.*)',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
      ],
    },
    null,
    2
  ) + '\n'
);
console.log(`iso demo: ${out}`);
