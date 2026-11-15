// One install per checkout at a time (scripts/ensure-install.mjs).
//
// The SessionStart hook's copy of node_modules takes ~20 s, and an agent that
// runs `npm run check` meanwhile would otherwise start a second copy over the
// first: each would delete the other's staging directory, and either could
// rename an unfinished tree into place.
//
// The lock is `<dir>/node_modules.lock`, a directory holding exactly one entry,
// `owner-<pid>`. Every state change is one rename(2) or rmdir(2), each atomic
// and each conditional on what is there, so no caller can act on a state it
// read a moment ago:
//
//   acquire   rename `lock.cand-<me>` (already holding `owner-<me>`) onto the
//             lock. It fails while a lock with an owner exists (ENOTEMPTY), and
//             replaces an empty one left by an owner killed while releasing.
//   take over rename `lock/owner-<dead>` to `lock/owner-<me>`. It succeeds for
//             exactly one caller, and only while the dead pid still owns it, so
//             a live lock is never moved or deleted.
//   release   remove `owner-<me>`, then rmdir the lock. rmdir fails on a
//             non-empty directory, so it never removes another owner's lock.
//
// Two earlier designs lost exclusivity in races Greptile found on #703/#704:
// moving the lock aside to inspect it, and a takeover guard whose expiry could
// be cleared by two callers at once. Neither a guard nor a timeout is needed now.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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

/** The lock's entry naming its owner: `owner-<pid>`, or the earlier format's `pid` file. */
function ownerEntry(lock) {
  let names;
  try {
    names = readdirSync(lock);
  } catch {
    return null;
  }
  const current = names.find((n) => /^owner-\d+$/.test(n));
  if (current) return { name: current, pid: Number(current.slice('owner-'.length)) };
  if (names.includes('pid')) {
    try {
      return { name: 'pid', pid: Number(readFileSync(join(lock, 'pid'), 'utf8')) || 0 };
    } catch {
      return null;
    }
  }
  return null;
}

/** The pid holding the lock, or 0 when there is none (no lock, or an empty one). */
export const ownerOf = (lock) => ownerEntry(lock)?.pid ?? 0;

/**
 * Take the lock from `deadOwner` for `me`, in one rename of the dead owner's
 * own entry. True for exactly one caller, and only while `deadOwner` still
 * holds it.
 */
export function takeOverFrom(lock, deadOwner, me = process.pid) {
  const entry = ownerEntry(lock);
  if (!entry || entry.pid !== deadOwner) return false;
  try {
    renameSync(join(lock, entry.name), join(lock, `owner-${me}`));
    return true;
  } catch {
    return false; // another caller took it first, or the owner released it
  }
}

function release(lock) {
  try {
    unlinkSync(join(lock, `owner-${process.pid}`));
  } catch {
    return; // not ours (taken over, which needs us dead) or already gone
  }
  try {
    rmdirSync(lock);
  } catch {
    // a new owner moved in after our unlink; it is theirs now
  }
}

/**
 * Run `action` holding `<dir>/node_modules.lock`, or return `{ status: 'busy' }`
 * when another live process still holds it after `waitMs`. A dead owner's lock
 * (a hook killed at its timeout) is taken over at once.
 */
export function withInstallLock(dir, waitMs, action) {
  const lock = join(dir, 'node_modules.lock');
  const candidate = `${lock}.cand-${process.pid}`;
  const deadline = Date.now() + waitMs;
  rmSync(candidate, { recursive: true, force: true });
  mkdirSync(candidate);
  writeFileSync(join(candidate, `owner-${process.pid}`), '');
  let held = false;
  try {
    for (;;) {
      try {
        renameSync(candidate, lock);
        held = true;
        break;
      } catch (error) {
        if (!['ENOTEMPTY', 'EEXIST', 'ENOTDIR'].includes(error.code)) throw error;
      }
      const owner = ownerOf(lock);
      if (owner && !alive(owner) && takeOverFrom(lock, owner)) {
        held = true;
        break;
      }
      if (Date.now() >= deadline) return { status: 'busy' };
      sleep(owner ? 500 : 50);
    }
    return action();
  } finally {
    rmSync(candidate, { recursive: true, force: true });
    if (held) release(lock);
  }
}
