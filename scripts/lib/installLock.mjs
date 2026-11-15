// One install per checkout at a time (scripts/ensure-install.mjs).
//
// The SessionStart hook's copy of node_modules takes ~20 s, and an agent that
// runs `npm run check` meanwhile would otherwise start a second copy over the
// first: each would delete the other's staging directory, and either could
// rename an unfinished tree into place.
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const ownerOf = (lock) => {
  try {
    return Number(readFileSync(join(lock, 'pid'), 'utf8')) || 0;
  } catch {
    return 0;
  }
};

/**
 * Run `action` holding `<dir>/node_modules.lock`, or return `{ status: 'busy' }`
 * when another live process still holds it after `waitMs`.
 *
 * The lock is a directory (mkdir is atomic) holding its owner's pid. A hook
 * killed at its timeout leaves it behind, so a dead owner's lock is taken over
 * at once instead of blocking every later call.
 */
export function withInstallLock(dir, waitMs, action) {
  const lock = join(dir, 'node_modules.lock');
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = ownerOf(lock);
    const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
    // No pid yet: the owner is between mkdir and its write. Give it a minute.
    if (owner ? !alive(owner) : age > 60_000) {
      rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (Date.now() >= deadline) return { status: 'busy' };
    sleep(500);
  }
  try {
    writeFileSync(join(lock, 'pid'), String(process.pid));
    return action();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
