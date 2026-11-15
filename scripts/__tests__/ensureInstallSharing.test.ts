import { describe, expect, it, vi } from 'vitest';
import { existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureInstall } from '../ensure-install.mjs';
import { copy, installFixture, marker } from './installFixture';

// What ensure-install does when a checkout's install is not its own to change:
// a node_modules that is a link to another checkout's, and a second call while
// the first is still copying.
const { checkout } = installFixture();

const linkTo = (shared: string, dir: string) =>
  symlinkSync(join(shared, 'node_modules'), join(dir, 'node_modules'));
const isLink = (dir: string) => lstatSync(join(dir, 'node_modules')).isSymbolicLink();

// The old hook linked node_modules to the main checkout when it could not
// clone. A link that matches the lockfile is still not this checkout's own:
// `npm ci` here would rebuild it under every session that shares it.
describe('a shared (linked) install', () => {
  it('is replaced by a private copy even when it matches the lockfile', () => {
    const shared = checkout('main', '5.0.1', '5.0.1');
    const dir = checkout('wt', '5.0.1');
    linkTo(shared, dir);
    const result = ensureInstall(dir, { candidates: [shared], clone: copy });
    expect(result).toEqual({ status: 'copied', from: shared });
    expect(isLink(dir)).toBe(false);
    expect(marker(shared)).toBe('5.0.1');
  });

  // A linked install belongs to another checkout: installing through it rebuilds
  // the tree under every session that shares it. Drop the link, never its target.
  it('is unlinked when stale, without touching the checkout it points at', () => {
    const shared = checkout('main', '5.0.1', '3.2.7');
    const dir = checkout('wt', '5.0.1');
    linkTo(shared, dir);
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    ensureInstall(dir, { candidates: [sibling], clone: copy });
    expect(isLink(dir)).toBe(false);
    expect(marker(dir)).toBe('5.0.1');
    expect(marker(shared)).toBe('3.2.7');
  });

  // A volume without copy-on-write: the copy fails after a source was found.
  // The link still works, so it stays until a whole private copy can replace it.
  it('is kept when the copy fails', () => {
    const shared = checkout('main', '5.0.1', '5.0.1');
    const dir = checkout('wt', '5.0.1');
    linkTo(shared, dir);
    const clone = () => {
      throw new Error('clone not supported on this volume');
    };
    const result = ensureInstall(dir, { candidates: [shared], clone });
    expect(result.status).toBe('shared');
    expect(isLink(dir)).toBe(true);
    expect(marker(dir)).toBe('5.0.1');
  });

  it('is kept, and reported, when no private copy can be made right now', () => {
    const shared = checkout('main', '5.0.1', '5.0.1');
    const dir = checkout('wt', '5.0.1');
    linkTo(shared, dir);
    const result = ensureInstall(dir, { candidates: [], clone: null });
    expect(result.status).toBe('shared');
    expect(isLink(dir)).toBe(true);
  });
});

// The hook's copy takes ~20 s. An agent that runs `npm run check` meanwhile
// must not start a second copy over the first.
describe('two calls for the same checkout', () => {
  const lockDir = (dir: string) => join(dir, 'node_modules.lock');
  const heldBy = (dir: string, pid: number) => {
    mkdirSync(lockDir(dir));
    writeFileSync(join(lockDir(dir), 'pid'), String(pid));
  };

  it('does not touch the install while another live call holds the lock', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    heldBy(dir, process.pid);
    const npmCi = vi.fn();
    const result = ensureInstall(dir, {
      candidates: [],
      clone: copy,
      npmCi,
      install: true,
      waitMs: 0,
    });
    expect(result.status).toBe('busy');
    expect(npmCi).not.toHaveBeenCalled();
    expect(marker(dir)).toBe('3.2.7');
  });

  // A hook killed at its timeout leaves its lock behind.
  it('takes over the lock of a process that no longer exists', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    const sibling = checkout('sibling', '5.0.1', '5.0.1');
    heldBy(dir, 999_999_999);
    const result = ensureInstall(dir, { candidates: [sibling], clone: copy, waitMs: 0 });
    expect(result.status).toBe('copied');
    expect(existsSync(lockDir(dir))).toBe(false);
  });

  it('releases the lock when it is done', () => {
    const dir = checkout('wt', '5.0.1', '3.2.7');
    ensureInstall(dir, { candidates: [], clone: copy });
    expect(existsSync(lockDir(dir))).toBe(false);
  });
});
