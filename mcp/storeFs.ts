// The only place the store writes bytes: temp file, fsync, rename over the
// target. Several server processes (Desktop plus every Claude Code window)
// share one folder, so a reader sees the old file or the new one, never half.
import type * as fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { TEMP_PREFIX } from './storePath';

/** The slice of node:fs/promises the store uses; tests swap pieces to simulate failures. */
export type StoreFs = Pick<
  typeof fsp,
  'mkdir' | 'open' | 'rename' | 'rm' | 'rmdir' | 'readFile' | 'readdir' | 'stat' | 'utimes'
>;

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const DELAYS_MS = [10, 25, 60, 150, 300]; // 6 tries in all, about half a second

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Write `data` to `target` atomically and stamp its modification time `at`.
 * `stillValid` is asked right before each rename attempt; if it says no, nothing is
 * written and this returns false (forget() ran while this write was in flight).
 * On Windows another process (or an antivirus scan) can hold the target for a
 * moment, so a rename refused with EPERM/EBUSY/EACCES is retried with a short
 * backoff. Throws the last error if it never goes through; the temp file is
 * removed either way.
 */
export async function atomicWrite(
  fs: StoreFs,
  target: string,
  data: Buffer,
  at: number,
  {
    sleep = sleepMs,
    stillValid,
  }: { sleep?: (ms: number) => Promise<void>; stillValid?: () => Promise<boolean> } = {}
): Promise<boolean> {
  // Owner only: these are a student's grades and course files.
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const tmp = path.join(
    path.dirname(target),
    `${TEMP_PREFIX}${process.pid}-${randomBytes(6).toString('hex')}`
  );
  try {
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Only orders eviction, so a refusal is not worth failing the write for.
    await fs.utimes(tmp, new Date(at), new Date(at)).catch(() => {});
    for (let attempt = 0; ; attempt++) {
      // Asked before every try: forget() can run while a refused rename waits.
      if (stillValid && !(await stillValid())) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        return false;
      }
      try {
        await fs.rename(tmp, target);
        return true;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (!code || !RETRY_CODES.has(code) || attempt >= DELAYS_MS.length) throw e;
        await sleep(DELAYS_MS[attempt]!);
      }
    }
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}

/**
 * Runs `fn` while holding a lock no other process can hold: a file created exclusively
 * beside the data, removed afterwards. For a change that reads several files and writes
 * back (the ledger's cap and dedupe, an original and its record), which two server processes
 * on one folder would otherwise interleave and lose one side of. Its name starts with the
 * temp prefix, so the store's scan and index skip it.
 *
 * The holder refreshes the file's time every `beatMs` while `fn` runs, so a long write is
 * never mistaken for a crash: a lock is stale only when its time has not moved for `staleMs`
 * (its holder crashed), and is then taken over. The file holds the holder's own token and is
 * removed at the end only if it still does, so a holder that was taken over never deletes
 * the next holder's lock. When the folder cannot be used at all, nobody else shares it, so
 * `fn` runs without a lock.
 */
export async function withFileLock<T>(
  fs: StoreFs,
  dir: string,
  name: string,
  fn: () => Promise<T>,
  {
    sleep = sleepMs,
    pause = 25,
    staleMs = 10_000,
    beatMs = 2_000,
  }: {
    sleep?: (ms: number) => Promise<void>;
    pause?: number;
    staleMs?: number;
    beatMs?: number;
  } = {}
): Promise<T> {
  const lock = path.join(dir, `${TEMP_PREFIX}lock-${name}`);
  const token = `${process.pid}-${randomBytes(8).toString('hex')}`;
  const content = () => fs.readFile(lock, 'utf8').catch(() => null);
  let held = false;
  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    while (!held) {
      try {
        const handle = await fs.open(lock, 'wx', 0o600);
        try {
          await handle.writeFile(token);
        } finally {
          await handle.close();
        }
        held = true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        const seen = await content();
        const st = await fs.stat(lock).catch(() => null);
        // Untouched for staleMs: its holder is gone. Taken over only if it is still that file.
        if (st && Date.now() - st.mtimeMs > staleMs) {
          if ((await content()) === seen) await fs.rm(lock, { force: true });
        } else await sleep(pause);
      }
    }
  } catch {
    // The folder cannot be used: the store is memory-only, so there is no other process to wait for.
  }
  const beat = held
    ? setInterval(() => {
        void content().then((c) =>
          c === token ? fs.utimes(lock, new Date(), new Date()).catch(() => {}) : undefined
        );
      }, beatMs)
    : undefined;
  beat?.unref?.();
  try {
    return await fn();
  } finally {
    if (beat) clearInterval(beat);
    if (held && (await content()) === token) await fs.rm(lock, { force: true }).catch(() => {});
  }
}
