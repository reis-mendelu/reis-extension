// Downloads every catalog emoji missing from public/emoji, from the pinned
// Twemoji release. Run after adding an entry to src/data/eventEmoji.ts:
//   npm run emoji:fetch
// The SVGs are committed; the app never fetches them at runtime.
import { open, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EVENT_EMOJI } from '../../src/data/eventEmoji';
import { asPlainSvg } from './plainSvg';

const VERSION = '15.1.0';
const DIR = fileURLToPath(new URL('../../public/emoji/', import.meta.url));

let added = 0;
for (const { code } of EVENT_EMOJI) {
  const out = `${DIR}${code}.svg`;
  // 'wx' creates the file or fails if it exists, in one step: no window
  // between "is it there?" and the write for another writer to slip into.
  const file = await open(out, 'wx').catch((e: NodeJS.ErrnoException) => {
    if (e.code === 'EEXIST') return null;
    throw e;
  });
  if (!file) continue;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${VERSION}/assets/svg/${code}.svg`
    );
    if (!res.ok) throw new Error(`${code}: HTTP ${res.status} (not in Twemoji ${VERSION}?)`);
    // The bytes ship inside the app, so only a plain drawing gets written.
    await file.writeFile(asPlainSvg(code, await res.text()));
    added += 1;
    console.log('added', code);
  } catch (e) {
    await file.close();
    await unlink(out);
    throw e;
  }
  await file.close();
}
console.log(`${added} added, ${EVENT_EMOJI.length} in the catalog`);
