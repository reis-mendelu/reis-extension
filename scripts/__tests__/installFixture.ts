import { afterEach, beforeEach } from 'vitest';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Throwaway checkouts for the ensure-install tests: a folder with a lockfile
// that pins one package, and optionally an install of it at some version.
const lockFor = (vitest: string) => ({ packages: { 'node_modules/vitest': { version: vitest } } });

/** Registers the temp-folder lifecycle for the calling test file. */
export function installFixture() {
  let root = '';
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'reis-install-')));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** A checkout with a lockfile and, optionally, an install at some version. */
  const checkout = (name: string, locked: string, installed?: string) => {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package-lock.json'), JSON.stringify(lockFor(locked)));
    if (installed) {
      mkdirSync(join(dir, 'node_modules', 'vitest'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'vitest', 'marker'), installed);
      writeFileSync(join(dir, 'node_modules', 'vitest', 'package.json'), '{}');
      writeFileSync(
        join(dir, 'node_modules', '.package-lock.json'),
        JSON.stringify(lockFor(installed))
      );
    }
    return dir;
  };

  return { checkout, root: () => root };
}

/** Which version's files are in a checkout's install. */
export const marker = (dir: string) =>
  readFileSync(join(dir, 'node_modules', 'vitest', 'marker'), 'utf8');

// A stand-in for the APFS clone, so the decisions are testable on any platform.
// Like cloneTree it REPLACES the target: nothing of the old tree may survive.
export const copy = (from: string, to: string) => {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
};
