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

/**
 * Removes `dev-real-data.json` from a build output directory, then verifies
 * it is actually gone. Throws — rather than logging and continuing — if the
 * file is still present after the removal attempt, so a build that somehow
 * bypasses the delete step fails loudly instead of quietly publishing it.
 *
 * @param {string} outDir absolute path to the build output directory
 * @throws {Error} if the file still exists after the removal attempt
 */
export function stripDevRealDataFile(outDir) {
  const target = join(outDir, DEV_REAL_DATA_FILENAME);

  if (existsSync(target)) {
    try {
      rmSync(target);
    } catch {
      // Fall through — the existsSync check below is what actually decides
      // pass/fail, so a failed delete surfaces as the loud error below
      // instead of an opaque fs error.
    }
  }

  if (existsSync(target)) {
    throw new Error(
      `Refusing to finish the web build: ${target} still exists.\n` +
        `${DEV_REAL_DATA_FILENAME} is a real scraped IS Mendelu student snapshot ` +
        `(grades, schedule, documents) and must never ship in a build that gets ` +
        `deployed to a public URL.`
    );
  }
}

/**
 * Vite plugin wiring `stripDevRealDataFile` into the build. Runs in
 * `closeBundle`, after Vite has written the bundle and copied `publicDir`
 * into `outDir`, so the file is guaranteed to have already landed there if
 * it was going to.
 */
export function stripDevRealDataPlugin() {
  let outDir;
  return {
    name: 'reis-strip-dev-real-data',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      stripDevRealDataFile(outDir);
    },
  };
}
