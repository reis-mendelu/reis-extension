// Fails unless release-notes/<package.json version>.cs.txt holds agreed text.
// Run by the Release gate (so the release PR goes red) and again by the tag job
// before it tags: a tag, once pushed, cannot move, and every store submission
// reads this file from the tagged commit.
//
//   npx tsx scripts/release/assert-notes.ts [version]
import { readFileSync } from 'node:fs';
import { loadReleaseNotes } from '../lib/releaseNotes';

try {
  const version =
    process.argv[2] ??
    (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version;
  const text = loadReleaseNotes(version);
  console.log(`release-notes/${version}.cs.txt OK (${text.length} chars):\n${text}`);
} catch (err) {
  console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
