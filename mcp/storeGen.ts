// Safety around forget(): a write that began before it must never land after it,
// from any process, and nothing may publish an index that names what it deleted.
//
// Two things make that checkable. forget() replaces a random token in the folder
// (the generation) before it deletes anything; every write remembers the token it
// started under and checks it again before and after its rename. And for as long
// as forget() is still deleting, it keeps a marker file, `.forgetting-<id>`, so
// that a reader who looks at the token in the middle of a forget (after the
// bump, before the last delete) can tell it from a forget that is over: while a
// live marker exists the token is unreadable (null), and null is never "the
// same", so nothing starts and nothing publishes. Neither file is student data;
// the token survives forget(), the marker does not outlive it.
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { atomicWrite, type StoreFs } from './storeFs';
import { FORGET_PREFIX, GEN_FILE } from './storePath';

/** A marker not refreshed for this long belongs to a forget() that crashed. */
export const FORGET_STALE_MS = 5 * 60_000;
/** How often a running forget() refreshes its marker, even in the middle of one slow delete. */
export const FORGET_BEAT_MS = 30_000;

/** Live = refreshed recently; a clock far off in either direction counts as abandoned. */
async function markerIsLive(fs: StoreFs, abs: string, now: () => number): Promise<boolean> {
  try {
    const age = now() - (await fs.stat(abs)).mtimeMs;
    return Math.abs(age) <= FORGET_STALE_MS;
  } catch (e) {
    // Gone between the listing and now means that forget finished; any other
    // failure (a Windows delete-pending EPERM) cannot prove it, so it counts as live.
    return (e as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

/** True if a forget() in any process has begun deleting and has not finished (or crashed). */
async function forgetRunning(fs: StoreFs, dir: string, now: () => number): Promise<boolean> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    // No folder, or one we may not read (it cannot be used at all, so the store is
    // going memory-only): no forget to wait for. Anything else (EMFILE under load)
    // cannot prove there is none.
    const code = (e as NodeJS.ErrnoException).code;
    return code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'EACCES';
  }
  for (const name of names)
    if (name.startsWith(FORGET_PREFIX) && (await markerIsLive(fs, path.join(dir, name), now)))
      return true;
  return false;
}

/** True for the marker of a forget() that is still alive; forget() must leave those alone. */
export const isLiveMarker = async (fs: StoreFs, dir: string, name: string, now: () => number) =>
  name.startsWith(FORGET_PREFIX) && (await markerIsLive(fs, path.join(dir, name), now));

/**
 * What readGeneration() returns while a forget() is deleting. It is not a token
 * (those are hex), so it never equals one, and unlike null it says why: a caller
 * that keeps the answer (a write waiting its turn, a download that started
 * earlier) can refuse later without looking again, when the forget may be over.
 */
export const FORGETTING = 'forgetting';

/**
 * The folder's token: '' when there is none yet (no folder, no file), null when
 * it exists but cannot be read, FORGETTING while a forget() is in progress. null
 * and FORGETTING never count as "the same" (sameGeneration). The token is read
 * first and the marker second, which is what makes this sound: a forget() writes
 * its marker before it bumps the token and clears it after the last delete, so a
 * token read after the bump is followed by a marker read that sees the forget
 * unfinished, or one that finds it finished and the folder already empty.
 */
export async function readGeneration(
  fs: StoreFs,
  dir: string,
  now: () => number = Date.now
): Promise<string | null> {
  let token: string | null;
  try {
    token = (await fs.readFile(path.join(dir, GEN_FILE), 'utf8')).trim();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException)?.code;
    token = code === 'ENOENT' || code === 'ENOTDIR' ? '' : null;
  }
  return token !== null && (await forgetRunning(fs, dir, now)) ? FORGETTING : token;
}

/** A token a write can be bound to: it was readable and no forget() was deleting. */
export const isOpen = (g: string | null): g is string => g !== null && g !== FORGETTING;

export type ForgetMarker = { beat: () => Promise<void>; end: () => Promise<void> };

/** Announce a forget(), before its token is bumped. One marker per call, so two forgets cannot clear each other's. */
export async function beginForget(
  fs: StoreFs,
  dir: string,
  now: () => number
): Promise<ForgetMarker> {
  const file = path.join(dir, `${FORGET_PREFIX}${process.pid}-${randomBytes(6).toString('hex')}`);
  const body = Buffer.from(String(process.pid));
  await atomicWrite(fs, file, body, now());
  // beat() and end() run one after another: a beat still in flight when end()
  // is called must land before the marker is removed, not after.
  let ended = false;
  let queue: Promise<unknown> = Promise.resolve();
  const inOrder = (fn: () => Promise<void>) => (queue = queue.then(fn, fn));
  return {
    /**
     * Prove this forget() is alive. If another forget swept the marker (a long
     * pause made it look abandoned) put it back; any other failure is not worth
     * stopping the delete for.
     */
    beat: () =>
      inOrder(async () => {
        if (ended) return;
        try {
          await fs.utimes(file, new Date(now()), new Date(now()));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT')
            await atomicWrite(fs, file, body, now()).catch(() => {});
        }
      }),
    /** The deletion is over (or gave up, and said so): readers may publish again. */
    end: () =>
      inOrder(async () => {
        ended = true;
        await fs.rm(file, { force: true }).catch(() => {});
      }),
  };
}

export const sameGeneration = (a: string | null, b: string | null) => isOpen(a) && a === b;

export async function bumpGeneration(fs: StoreFs, dir: string, at: number): Promise<void> {
  const token = Buffer.from(randomBytes(8).toString('hex'));
  await atomicWrite(fs, path.join(dir, GEN_FILE), token, at);
}

/** Remove the now-empty folders above a file, up to but not including the store folder. */
export async function pruneEmptyDirs(fs: StoreFs, dir: string, rel: string): Promise<void> {
  const parts = rel.split('/').slice(0, -1);
  for (let n = parts.length; n > 0; n--) {
    try {
      await fs.rmdir(path.join(dir, ...parts.slice(0, n)));
    } catch {
      return; // not empty (someone else's files) or already gone
    }
  }
}

// A problem with this one file, not with the folder: the store stays on disk.
const PER_PATH = new Set([
  'EEXIST',
  'EISDIR',
  'ENOTDIR',
  'ENAMETOOLONG',
  'EINVAL',
  'ENOENT',
  'EMFILE',
  'ENFILE',
]);

/** True when a failed write is about this file's name and the folder itself still works. */
export async function isPerPathFailure(fs: StoreFs, dir: string, e: unknown): Promise<boolean> {
  const code = (e as NodeJS.ErrnoException)?.code;
  if (!code || !PER_PATH.has(code)) return false;
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
}
