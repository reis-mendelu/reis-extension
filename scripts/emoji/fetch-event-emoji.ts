// Downloads every catalog emoji missing from public/emoji, from the pinned
// Twemoji release. Run after adding an entry to src/data/eventEmoji.ts:
//   npm run emoji:fetch
// The SVGs are committed; the app never fetches them at runtime.
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EVENT_EMOJI } from '../../src/data/eventEmoji';

const VERSION = '15.1.0';
const DIR = fileURLToPath(new URL('../../public/emoji/', import.meta.url));

let added = 0;
for (const { code } of EVENT_EMOJI) {
  const out = `${DIR}${code}.svg`;
  if (existsSync(out)) continue;
  const res = await fetch(
    `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${VERSION}/assets/svg/${code}.svg`
  );
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status} (not in Twemoji ${VERSION}?)`);
  await writeFile(out, await res.text());
  added += 1;
  console.log('added', code);
}
console.log(`${added} added, ${EVENT_EMOJI.length} in the catalog`);
