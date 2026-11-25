// Safety around forget(): a write that began before it must never land after it,
// from any process. forget() replaces a random token in the folder first; every
// write remembers the token it started under and checks it again before and
// after its rename. The token is not student data and survives forget().
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { atomicWrite, type StoreFs } from './storeFs';
import { GEN_FILE } from './storePath';

export async function readGeneration(fs: StoreFs, dir: string): Promise<string> {
  try {
    return (await fs.readFile(path.join(dir, GEN_FILE), 'utf8')).trim();
  } catch {
    return '';
  }
}

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
