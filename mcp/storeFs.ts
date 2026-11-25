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
