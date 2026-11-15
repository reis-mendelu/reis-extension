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

const ageOf = (path) =>
  Date.now() - (statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());

/**
 * Remove a dead owner's lock, never a live one. A caller acts on what it saw a
 * moment ago, and by now another caller may have cleared the dead lock and
 * taken its own. Moving the lock aside to look (the earlier tombstone rename)
 * briefly took a LIVE lock away: a third caller could take the empty slot, the
 * move back then failed, and two installs ran (Greptile on #703).
 *
 * So the check and the delete happen under `<lock>.takeover`, a second mkdir
 * mutex: only its holder removes the lock, and only while the lock still names
 * the owner it saw dead. A new owner cannot appear while it does, because
 * nobody can take a lock that still exists. Everyone else just retries.
 */
export function clearDeadLock(lock, deadOwner) {
  const guard = `${lock}.takeover`;
  try {
    mkdirSync(guard);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A takeover killed between its two syscalls leaves the guard behind.
    if (ageOf(guard) > 60_000) rmSync(guard, { recursive: true, force: true });
    return;
  }
  try {
    const owner = ownerOf(lock);
    const stillDead = owner ? !alive(owner) : ageOf(lock) > 60_000;
    if (owner === deadOwner && stillDead) rmSync(lock, { recursive: true, force: true });
  } finally {
    rmSync(guard, { recursive: true, force: true });
  }
}

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
    // No pid yet: the owner is between mkdir and its write. Give it a minute.
    if (owner ? !alive(owner) : ageOf(lock) > 60_000) {
      clearDeadLock(lock, owner);
      sleep(50);
      continue;
    }
    if (Date.now() >= deadline) return { status: 'busy' };
    sleep(500);
  }
  try {
    writeFileSync(join(lock, 'pid'), String(process.pid));
    return action();
  } finally {
    // Only a lock this process still owns: one taken over meanwhile is not ours.
    if (ownerOf(lock) === process.pid) rmSync(lock, { recursive: true, force: true });
  }
}
