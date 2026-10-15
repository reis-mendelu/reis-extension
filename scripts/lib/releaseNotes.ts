// The "What's new" text is an input to the release, not something typed into a
// store console afterwards. It lives in the repo as release-notes/<version>.cs.txt,
// so the release PR shows the exact words that will reach students, and the
// pipeline can refuse to submit a version that has none.
//
// One Czech text feeds both stores: App Store `cs` and Play `cs-CZ`. Play's
// limit is the tighter one (500 characters), so that is the one enforced.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Google Play release notes: 500 characters per language. */
export const PLAY_NOTES_MAX = 500;

export function releaseNotesPath(version: string): string {
  return `release-notes/${version}.cs.txt`;
}

export function loadReleaseNotes(version: string, root: string = process.cwd()): string {
  // The version becomes part of a path, so anything but x.y.z is refused rather
  // than sanitised.
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`"${version}" is not a plain x.y.z version.`);
  }
  const path = releaseNotesPath(version);
  let text: string;
  try {
    text = readFileSync(resolve(root, path), 'utf8').trim();
  } catch {
    throw new Error(
      `No release notes for ${version}. Create ${path} with the agreed Czech "What's new" ` +
        `text in the release PR; the pipeline will not submit without it.`
    );
  }
  if (!text) throw new Error(`${path} is empty: nothing is submitted without agreed copy.`);
  if (text.length > PLAY_NOTES_MAX) {
    throw new Error(
      `${path} is ${text.length} characters; Google Play allows ${PLAY_NOTES_MAX} per language.`
    );
  }
  return text;
}
