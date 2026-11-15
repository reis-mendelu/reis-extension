import { describe, expect, it, vi } from 'vitest';
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { cloneTree, ensureInstall } from '../ensure-install.mjs';
import { copy, installFixture, marker } from './installFixture';

const { checkout, root } = installFixture();

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

  it('replaces a stale install instead of keeping it, leftovers included', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    mkdirSync(join(dir, 'node_modules', 'left-over'));
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    ensureInstall(dir, { candidates: [sibling], clone: copy });
    expect(marker(dir)).toBe('5.0.1');
    expect(existsSync(join(dir, 'node_modules', 'left-over'))).toBe(false);
  });

  // npm trusts its record only while the folders it names exist.
  it('does not trust a record whose package folder is gone', () => {
    const dir = checkout('wt', '5.0.1', '5.0.1');
    rmSync(join(dir, 'node_modules', 'vitest'), { recursive: true });
    const result = ensureInstall(dir, { candidates: [], clone: copy });
    expect(result.status).toBe('stale');
    expect(result.stale).toEqual([{ name: 'vitest', want: '5.0.1', have: null }]);
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
    const npmCi = vi.fn();
    const result = ensureInstall(dir, { candidates: [], clone: copy, npmCi, install: true });
    expect(npmCi).toHaveBeenCalledOnce();
    expect(result.status).toBe('stale');
  });

  it('reports a failed npm ci even when the tree it left looks complete', () => {
    const dir = checkout('wt', '5.0.1');
    const npmCi = vi.fn(() => {
      checkout('wt', '5.0.1', '5.0.1');
      return false;
    });
    expect(ensureInstall(dir, { candidates: [], clone: copy, npmCi, install: true })).toEqual({
      status: 'failed',
    });
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
    const to = join(root(), 'wt', 'node_modules');
    mkdirSync(join(root(), 'wt'));
    cloneTree(from, to);
    expect(readFileSync(join(to, 'vitest', 'marker'), 'utf8')).toBe('5.0.1');
    expect(existsSync(`${to}.incoming`)).toBe(false);
  });

  it('replaces a link with the copy and leaves the linked install untouched', () => {
    const shared = checkout('main', '5.0.1', '5.0.1');
    mkdirSync(join(root(), 'wt'));
    const to = join(root(), 'wt', 'node_modules');
    symlinkSync(join(shared, 'node_modules'), to);
    cloneTree(join(shared, 'node_modules'), to);
    expect(lstatSync(to).isSymbolicLink()).toBe(false);
    expect(marker(shared)).toBe('5.0.1');
    expect(readFileSync(join(to, 'vitest', 'marker'), 'utf8')).toBe('5.0.1');
  });

  it('clears what a killed copy left behind', () => {
    const from = join(checkout('main', '5.0.1', '5.0.1'), 'node_modules');
    const to = join(root(), 'wt', 'node_modules');
    mkdirSync(`${to}.incoming/half`, { recursive: true });
    cloneTree(from, to);
    expect(existsSync(join(to, 'half'))).toBe(false);
    expect(existsSync(join(to, 'vitest', 'marker'))).toBe(true);
  });
});
