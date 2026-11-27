// Where the map lives on disk, and the guard every path handed to the store
// goes through. Decided with Dominik 2026-11-25 (docs/superpowers/specs/
// 2026-11-25-reis-for-claude-map-design.md): one shared folder per laptop,
// never a synced one, never the extension's own folder.
import { homedir as osHomedir } from 'node:os';
import path from 'node:path';

const FOLDER = 'reIS for Claude';

export function resolveStoreDir({
  platform = process.platform,
  env = process.env,
  homedir = osHomedir(),
}: {
  platform?: NodeJS.Platform;
  env?: Record<string, string | undefined>;
  homedir?: string;
} = {}): string {
  // Deliberately not CLAUDE_PLUGIN_DATA / CLAUDE_PLUGIN_ROOT: Desktop and every
  // Claude Code window must reach the same folder.
  if (platform === 'win32') {
    const local = env.LOCALAPPDATA;
    const base =
      local && path.win32.isAbsolute(local) ? local : path.win32.join(homedir, 'AppData', 'Local');
    return path.win32.join(base, FOLDER);
  }
  if (platform === 'darwin') {
    return path.posix.join(homedir, 'Library', 'Application Support', FOLDER);
  }
  const xdg = env.XDG_DATA_HOME;
  const base =
    xdg && path.posix.isAbsolute(xdg) ? xdg : path.posix.join(homedir, '.local', 'share');
  return path.posix.join(base, FOLDER);
}

export class StorePathError extends Error {
  constructor(reason: string) {
    super(`Invalid store path: ${reason}`);
    this.name = 'StorePathError';
  }
}

/** The store's own files; a caller must never name them. */
export const INDEX_FILE = 'index.json';
export const TEMP_PREFIX = '.tmp-';
/** Holds a random token that forget() replaces, so a write begun before it can tell. */
export const GEN_FILE = '.generation';
/** One empty file per running forget(); see storeGen.ts. Not a name a caller may use. */
export const FORGET_PREFIX = '.forgetting-';

/** Two names that differ only by case or Unicode form are one file on macOS and Windows. */
export const fold = (p: string) => p.normalize('NFC').toLowerCase();

// Windows stops at 260 characters in all; the folder itself takes about 60 of them.
const MAX_PATH = 200;
/** What the operating system accepts for a whole path: Windows stops at 260, others are not limited here. */
export const OS_MAX_PATH = path.sep === '\\' ? 259 : Infinity;
const MAX_SEGMENT_BYTES = 255;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const BAD_CHARS = /[\u0000-\u001f\u007f<>:"|?*\\]/;
const DEVICE =
  /^(con|prn|aux|nul|com[0-9\u00b9\u00b2\u00b3]|lpt[0-9\u00b9\u00b2\u00b3]|conin\$|conout\$) *(\..*)?$/i;

/**
 * A relative path the store may use, as given: forward slashes, no `.` or `..`,
 * nothing a Windows or macOS filesystem would read differently from how it
 * looks. Names come from IS, so this is a security boundary. It rejects rather
 * than repairs: a file that cannot be stored safely is skipped by its caller.
 */
export function safeRelPath(input: unknown): string {
  if (typeof input !== 'string') throw new StorePathError('not a string');
  const p = input.normalize('NFC');
  if (!p.trim()) throw new StorePathError('empty');
  if (p.length > MAX_PATH) throw new StorePathError('too long');
  if (p.startsWith('/')) throw new StorePathError('absolute');
  if (BAD_CHARS.test(p)) throw new StorePathError('forbidden character');
  const segments = p.split('/');
  for (const s of segments) {
    if (!s || s === '.' || s === '..') throw new StorePathError('empty, . or .. segment');
    if (/[. ]$/.test(s)) throw new StorePathError('segment ends with a dot or space');
    if (Buffer.byteLength(s) > MAX_SEGMENT_BYTES) throw new StorePathError('name too long');
    if (DEVICE.test(s)) throw new StorePathError('reserved device name');
    if (s.toLowerCase().startsWith(TEMP_PREFIX)) throw new StorePathError('reserved temp name');
  }
  // The first segment too: `.generation/x` would make the token a folder.
  if (
    [INDEX_FILE, GEN_FILE].includes(fold(segments[0]!)) ||
    fold(segments[0]!).startsWith(FORGET_PREFIX)
  )
    throw new StorePathError('reserved name');
  return p;
}

/** Absolute path inside `dir` for a guarded relative path (checked again, belt and braces). */
export function insideDir(dir: string, rel: string): string {
  const full = path.join(dir, ...safeRelPath(rel).split('/'));
  if (!full.startsWith(dir + path.sep)) throw new StorePathError('escapes the store folder');
  return full;
}
