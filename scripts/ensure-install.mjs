#!/usr/bin/env node
// Make node_modules match package-lock.json, as cheaply as possible:
//
//   node scripts/ensure-install.mjs [dir] [--install]
//
// 1. An install that already matches is left alone (silent, exit 0).
// 2. Otherwise copy one that matches from another checkout of this repo. On
//    APFS that is a copy-on-write clone: seconds, and almost no disk until the
//    trees diverge. Only a MATCHING install is copied — copying whatever the
//    main checkout held is how worktrees ran vitest 3 under a lockfile pinning 5.
// 3. Otherwise, with --install, run `npm ci`; without it, say so and exit 2.
//
// Plain .mjs with no dependencies: it has to run when node_modules is missing.
// Called by the SessionStart hook (no --install: a hook must not sit in npm for
// minutes) and by `npm run check` (--install).
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { staleInstall } from './lib/checkPlan.mjs';
import { withInstallLock } from './lib/installLock.mjs';

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

const installedIn = (dir) => readJson(join(dir, 'node_modules', '.package-lock.json'));

/**
 * Copy a tree so that `to` exists only once the whole copy does. The hook that
 * calls this is killed at its timeout; a copy written straight into
 * node_modules would leave a partial tree that resolves some imports and looks
 * installed. `<to>.incoming` is gitignored, and only ever touched by the call
 * that holds the install lock.
 */
export function cloneTree(from, to) {
  const incoming = `${to}.incoming`;
  rmSync(incoming, { recursive: true, force: true });
  execFileSync('cp', ['-Rc', from, incoming], { stdio: 'ignore' });
  rmSync(to, { recursive: true, force: true });
  renameSync(incoming, to);
}

/** Every other checkout of this repository, the main one first. */
export function otherCheckouts(dir) {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length));
  } catch {
    return [];
  }
}

function runNpmCi(dir) {
  spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const canClone = process.platform === 'darwin';

/**
 * @returns {{ status: 'ok' | 'copied' | 'installed' | 'stale' | 'shared' | 'busy', from?: string, stale?: object[] }}
 */
export function ensureInstall(dir, options = {}) {
  const {
    candidates = otherCheckouts(dir),
    clone = canClone ? cloneTree : null,
    npmCi = runNpmCi,
    install = false,
    waitMs = 120_000,
  } = options;
  const lock = readJson(join(dir, 'package-lock.json'));
  if (!lock) return { status: 'ok' };
  const modules = join(dir, 'node_modules');
  const stale = () => staleInstall(lock, installedIn(dir));
  // A link is another checkout's install, however well it matches: `npm ci`
  // here would rebuild that tree under every session sharing it.
  const linked = () => lstatSync(modules, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
  const owned = () => !linked() && stale().length === 0;
  if (owned()) return { status: 'ok' };

  return withInstallLock(dir, waitMs, () => {
    // Another call may have finished the job while this one waited.
    if (owned()) return { status: 'ok' };

    const here = resolve(dir);
    const matching = (clone ? candidates : []).filter((other) => {
      const theirs = join(other, 'node_modules');
      if (resolve(other) === here || !existsSync(theirs)) return false;
      return (
        !lstatSync(theirs).isSymbolicLink() && staleInstall(lock, installedIn(other)).length === 0
      );
    });

    if (linked()) {
      // A working link is only given up for something better; a stale one is
      // no use to anyone. Only the link goes, never the install it points at.
      if (stale().length === 0 && !install && matching.length === 0) return { status: 'shared' };
      unlinkSync(modules);
    }

    for (const other of matching) {
      try {
        clone(join(other, 'node_modules'), modules);
      } catch {
        continue; // not APFS, or the source vanished mid-copy: try the next
      }
      if (stale().length === 0) return { status: 'copied', from: other };
    }

    if (install) {
      npmCi(dir);
      if (stale().length === 0) return { status: 'installed' };
    }
    return { status: 'stale', stale: stale() };
  });
}

/** One line for whoever reads the hook or the check output. */
export function describeInstall(result) {
  if (result.status === 'copied')
    return `install: copied node_modules from ${result.from} (copy-on-write; this checkout owns it)`;
  if (result.status === 'installed')
    return 'install: ran npm ci (node_modules did not match package-lock.json)';
  if (result.status === 'shared')
    return "install: node_modules is a link to another checkout's install. It matches the lockfile, but do not run 'npm ci' through it; 'npm run check' replaces the link with this checkout's own install.";
  if (result.status === 'busy')
    return 'install: another install is running in this checkout (node_modules.lock). Try again when it has finished.';
  if (result.status === 'stale') {
    const [first] = result.stale;
    const example = first ? ` (e.g. ${first.name} ${first.have ?? 'missing'} → ${first.want})` : '';
    return `install: STALE — ${result.stale.length} packages differ from package-lock.json${example}. Run 'npm ci' here; until then typecheck and test results are not about your code.`;
  }
  return null;
}

// Real paths on both sides: /tmp is a symlink on macOS, and a mismatch here
// means the script silently does nothing and still exits 0.
const isMain = () => {
  try {
    return (
      realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1] ?? ''))
    );
  } catch {
    return false;
  }
};

if (isMain()) {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
  const result = ensureInstall(dir, { install: args.includes('--install') });
  const line = describeInstall(result);
  if (line) console.log(line);
  process.exit(result.status === 'stale' || result.status === 'busy' ? 2 : 0);
}
