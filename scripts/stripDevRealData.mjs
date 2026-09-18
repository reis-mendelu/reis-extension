import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// `vite.web.build.config.ts` inherits `publicDir` from vite.web.config.ts,
// which copies everything in `public/` verbatim — including the gitignored
// real scraped IS Mendelu student snapshot the localhost dev harness reads
// (public/dev-real-data.json, see dev/snapshotPlugin.ts). That snapshot must
// never reach dist-web/, which the deployment plan publishes to a public URL.
//
// This is the web-build equivalent of the `build:publicAssets` hook in
// wxt.config.ts, which strips the same file from production extension builds.
export const DEV_REAL_DATA_FILENAME = 'dev-real-data.json';

// `sanitise:snapshot` writes a second snapshot beside the first: the sanitised
// record `npm run preview:real` serves. Both are gitignored, both are real
// academic data, and for a long time only the first one was ever stripped —
// so preview-data.json rode into every production build made on a machine
// that had one on disk.
export const PREVIEW_DATA_FILENAME = 'preview-data.json';

/** Every local snapshot that must never appear in a build output. */
export const SNAPSHOT_FILENAMES = [DEV_REAL_DATA_FILENAME, PREVIEW_DATA_FILENAME];

/**
 * Removes `dev-real-data.json` from a build output directory, then verifies
 * it is actually gone. Throws — rather than logging and continuing — if the
 * file is still present after the removal attempt, so a build that somehow
 * bypasses the delete step fails loudly instead of quietly publishing it.
 *
 * @param {string} outDir absolute path to the build output directory
 * @param {string[]} [filenames] which snapshots to remove. Defaults to all of
 *   them; `build:web:real` passes a narrower list because the sanitised
 *   snapshot is the payload that build exists to serve.
 * @throws {Error} if the file still exists after the removal attempt
 */
export function stripDevRealDataFile(outDir, filenames = SNAPSHOT_FILENAMES) {
  const survivors = [];

  for (const filename of filenames) {
    const target = join(outDir, filename);

    if (existsSync(target)) {
      try {
        rmSync(target);
      } catch {
        // Fall through — the existsSync check below is what actually decides
        // pass/fail, so a failed delete surfaces as the loud error below
        // instead of an opaque fs error.
      }
    }

    if (existsSync(target)) survivors.push(target);
  }

  if (survivors.length > 0) {
    throw new Error(
      `Refusing to finish the build: ${survivors.join(', ')} still exists.\n` +
        `Local snapshots are real scraped IS Mendelu student data ` +
        `(grades, schedule, documents) and must never ship in a build that is ` +
        `deployed to a public URL or submitted to an app store.`
    );
  }
}

/**
 * Vite plugin wiring `stripDevRealDataFile` into the build. Runs in
 * `closeBundle`, after Vite has written the bundle and copied `publicDir`
 * into `outDir`, so the file is guaranteed to have already landed there if
 * it was going to.
 */
export function stripDevRealDataPlugin(filenames = SNAPSHOT_FILENAMES) {
  let outDir;
  return {
    name: 'reis-strip-dev-real-data',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      stripDevRealDataFile(outDir, filenames);
    },
  };
}
