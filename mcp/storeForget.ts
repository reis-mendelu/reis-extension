// Deleting the folder for forget() (store.ts calls it under its lock). The order
// is what makes forgotten content stay forgotten, from any process: raise the
// marker, bump the token, delete, take the marker down (storeGen.ts says why).
import path from 'node:path';
import type { StoreFs } from './storeFs';
import {
  FORGET_BEAT_MS,
  beginForget,
  bumpGeneration,
  isLiveMarker,
  type ForgetMarker,
} from './storeGen';
import { GEN_FILE } from './storePath';

/**
 * Another forget() deletes everything it listed, including this one's temp file
 * while its token or marker is being written: ENOENT as it lands. That is not a
 * failure, the other forget just got there first, so write it again.
 */
async function untilKept<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT' || attempt >= 8) throw e;
    }
  }
}

/** Delete everything in `dir` but the token. Throws if something could not be deleted. */
export async function forgetFolder(fs: StoreFs, dir: string, now: () => number): Promise<void> {
  // Without the marker nothing is deleted: a forget that cannot announce itself
  // cannot promise anything.
  let setupError: unknown;
  let marker: ForgetMarker | undefined;
  try {
    marker = await untilKept(() => beginForget(fs, dir, now));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOTDIR') throw e; // no folder to delete in
    setupError = e;
  }
  // A delete that takes longer than a beat must not look like a crashed forget.
  const timer = setInterval(() => void marker?.beat(), FORGET_BEAT_MS);
  timer.unref?.();
  try {
    try {
      await untilKept(() => bumpGeneration(fs, dir, now()));
    } catch (e) {
      setupError ??= e;
    }
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw e;
    }
    // One name that will not go (a writer still creating a file under it, a viewer
    // holding it on Windows) must not leave the names after it behind: delete the
    // rest, then say so.
    let failed: unknown;
    for (const name of names) {
      if (name === GEN_FILE) continue;
      // Another forget() still running keeps its marker; a crashed one's is swept.
      if (await isLiveMarker(fs, dir, name, now)) continue;
      try {
        await marker?.beat();
        await fs.rm(path.join(dir, name), {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 50,
        });
      } catch (e) {
        failed ??= e;
      }
    }
    if (failed) throw failed;
    if (setupError && (setupError as NodeJS.ErrnoException).code !== 'ENOTDIR') throw setupError;
  } finally {
    clearInterval(timer);
    // Also when a delete failed: forget() then says so, and what is left is the truth.
    await marker?.end();
  }
}
