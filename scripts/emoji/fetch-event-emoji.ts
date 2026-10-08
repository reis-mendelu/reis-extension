// Downloads every catalog emoji missing from public/emoji, from the pinned
// Twemoji release. Run after adding an entry to src/data/eventEmoji.ts:
//   npm run emoji:fetch
// The SVGs are committed; the app never fetches them at runtime.
import { link, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENT_EMOJI } from '../../src/data/eventEmoji';
import { asPlainSvg } from './plainSvg';

const VERSION = '15.1.0';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIR = join(ROOT, 'public/emoji');

// Staged under node_modules/.cache: the same filesystem as public/ (link needs
// that), gitignored, and outside anything a build copies. A run killed
// mid-download leaves its debris here, never a half-written emoji in public/.
await mkdir(join(ROOT, 'node_modules/.cache'), { recursive: true });
const STAGE = await mkdtemp(join(ROOT, 'node_modules/.cache/emoji-fetch-'));

// Read once, so a run fetches only what is missing (and a no-op run needs no
// network). Only an optimisation: link() below still refuses a taken name.
const shipped = new Set(await readdir(DIR));

let added = 0;
try {
  for (const { code } of EVENT_EMOJI) {
    if (shipped.has(`${code}.svg`)) continue;
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${VERSION}/assets/svg/${code}.svg`
    );
    if (!res.ok) throw new Error(`${code}: HTTP ${res.status} (not in Twemoji ${VERSION}?)`);
    // The bytes ship inside the app, so only a plain drawing gets written.
    const staged = join(STAGE, `${code}.svg`);
    await writeFile(staged, asPlainSvg(code, await res.text()), { flag: 'wx' });
    // link installs the complete file in one step and fails if the name is
    // taken: an emoji already in public/ is left alone, never overwritten.
    const installed = await link(staged, join(DIR, `${code}.svg`)).then(
      () => true,
      (e: NodeJS.ErrnoException) => {
        if (e.code === 'EEXIST') return false;
        throw e;
      }
    );
    if (installed) {
      added += 1;
      console.log('added', code);
    }
  }
} finally {
  await rm(STAGE, { recursive: true, force: true });
}
console.log(`${added} added, ${EVENT_EMOJI.length} in the catalog`);
