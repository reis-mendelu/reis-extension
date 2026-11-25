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

const MAX_PATH = 480;
const MAX_SEGMENT_BYTES = 255;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const BAD_CHARS = /[\u0000-\u001f\u007f<>:"|?*\\]/;
const DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

/**
 * A relative path the store may use, as given: forward slashes, no `.` or `..`,
 * nothing a Windows or macOS filesystem would read differently from how it
 * looks. Names come from IS, so this is a security boundary. It rejects rather
 * than repairs: a file that cannot be stored safely is skipped by its caller.
 */
export function safeRelPath(p: unknown): string {
  if (typeof p !== 'string') throw new StorePathError('not a string');
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
    if (s.startsWith(TEMP_PREFIX)) throw new StorePathError('reserved temp name');
  }
  if (p === INDEX_FILE) throw new StorePathError('reserved index name');
  return p;
}

/** Absolute path inside `dir` for a guarded relative path (checked again, belt and braces). */
export function insideDir(dir: string, rel: string): string {
  const full = path.join(dir, ...safeRelPath(rel).split('/'));
  if (!full.startsWith(dir + path.sep)) throw new StorePathError('escapes the store folder');
  return full;
}
