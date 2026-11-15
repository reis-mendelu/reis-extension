import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloneTree, ensureInstall } from '../ensure-install.mjs';

let root: string;

const lockFor = (vitest: string) => ({ packages: { 'node_modules/vitest': { version: vitest } } });

/** A checkout with a lockfile and, optionally, an install at some version. */
function checkout(name: string, locked: string, installed?: string) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lockFor(locked)));
  if (installed) {
    mkdirSync(join(dir, 'node_modules', 'vitest'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'vitest', 'marker'), installed);
    writeFileSync(
      join(dir, 'node_modules', '.package-lock.json'),
      JSON.stringify(lockFor(installed))
    );
  }
  return dir;
}

const marker = (dir: string) => readFileSync(join(dir, 'node_modules', 'vitest', 'marker'), 'utf8');
// A stand-in for the APFS clone, so the decisions are testable on any platform.
const copy = (from: string, to: string) => cpSync(from, to, { recursive: true });

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'reis-install-')));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('ensureInstall', () => {
  it('leaves an install that matches the lockfile alone', () => {
    const dir = checkout('wt', '5.0.1', '5.0.1');
    const npmCi = vi.fn();
    expect(ensureInstall(dir, { candidates: [], clone: copy, npmCi, install: true })).toEqual({
      status: 'ok',
    });
    expect(npmCi).not.toHaveBeenCalled();
  });

  // The bug this replaces: the hook copied the main checkout's install whatever
  // version it held. Only an install that matches THIS lockfile is worth copying.
  it('copies from the first checkout whose install matches, skipping a stale one', () => {
    const dir = checkout('wt', '5.0.1');
    const staleMain = checkout('main', '5.0.1', '3.2.7');
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    const result = ensureInstall(dir, { candidates: [staleMain, sibling], clone: copy });
    expect(result).toEqual({ status: 'copied', from: sibling });
    expect(marker(dir)).toBe('5.0.1');
  });

  it('replaces a stale install instead of keeping it', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    ensureInstall(dir, { candidates: [sibling], clone: copy });
    expect(marker(dir)).toBe('5.0.1');
  });

  it('reports what is stale when there is nothing to copy and it may not install', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    const npmCi = vi.fn();
    const result = ensureInstall(dir, { candidates: [], clone: copy, npmCi });
    expect(result.status).toBe('stale');
    expect(result.stale).toEqual([{ name: 'vitest', want: '5.0.1', have: '3.2.7' }]);
    expect(npmCi).not.toHaveBeenCalled();
  });

  it('runs npm ci when asked to and nothing matches', () => {
    const dir = checkout('wt', '5.0.1');
    const npmCi = vi.fn((target: string) => {
      checkout('wt', '5.0.1', '5.0.1');
      expect(target).toBe(dir);
    });
    expect(ensureInstall(dir, { candidates: [], clone: copy, npmCi, install: true })).toEqual({
      status: 'installed',
    });
  });

  it('says so when npm ci ran and the install still does not match', () => {
    const dir = checkout('wt', '5.0.1');
    const result = ensureInstall(dir, {
      candidates: [],
      clone: copy,
      npmCi: vi.fn(),
      install: true,
    });
    expect(result.status).toBe('stale');
  });

  // A linked install belongs to another checkout: installing through it rebuilds
  // the tree under every session that shares it. Drop the link, never its target.
  it('unlinks a stale shared install without touching the checkout it points at', () => {
    const shared = checkout('main', '5.0.1', '3.2.7');
    const dir = checkout('wt', '5.0.1');
    symlinkSync(join(shared, 'node_modules'), join(dir, 'node_modules'));
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    ensureInstall(dir, { candidates: [sibling], clone: copy });
    expect(lstatSync(join(dir, 'node_modules')).isSymbolicLink()).toBe(false);
    expect(marker(dir)).toBe('5.0.1');
    expect(marker(shared)).toBe('3.2.7');
  });

  it('never copies from itself or from a checkout with no install', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    const empty = checkout('empty', '5.0.1');
    const result = ensureInstall(dir, { candidates: [dir, empty], clone: copy });
    expect(result.status).toBe('stale');
  });
});

describe.skipIf(process.platform !== 'darwin')('cloneTree (APFS)', () => {
  // The SessionStart hook is killed at its timeout. A copy written straight to
  // node_modules would then be a partial tree that looks installed.
  it('fills the target only once the whole copy exists', () => {
    const from = join(checkout('main', '5.0.1', '5.0.1'), 'node_modules');
    const to = join(root, 'wt', 'node_modules');
    mkdirSync(join(root, 'wt'));
    cloneTree(from, to);
    expect(readFileSync(join(to, 'vitest', 'marker'), 'utf8')).toBe('5.0.1');
    expect(existsSync(`${to}.incoming`)).toBe(false);
  });

  it('clears what a killed copy left behind', () => {
    const from = join(checkout('main', '5.0.1', '5.0.1'), 'node_modules');
    const to = join(root, 'wt', 'node_modules');
    mkdirSync(`${to}.incoming/half`, { recursive: true });
    cloneTree(from, to);
    expect(existsSync(join(to, 'half'))).toBe(false);
    expect(existsSync(join(to, 'vitest', 'marker'))).toBe(true);
  });
});
