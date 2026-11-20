// One install per checkout at a time (scripts/ensure-install.mjs).
//
// The SessionStart hook's copy of node_modules takes ~20 s, and an agent that
// runs `npm run check` meanwhile would otherwise start a second copy over the
// first: each would delete the other's staging directory, and either could
// rename an unfinished tree into place.
//
// The lock is `<dir>/node_modules.install.lock`, a directory holding exactly
// one entry, `owner-<pid>`. Every state change is one rename(2) or rmdir(2),
// each atomic and each conditional on what is there, so no caller can act on
// a state it read a moment ago:
//
//   acquire   rename `<lock>.cand-<me>` (already holding `owner-<me>`) onto the
//             lock. It fails while a lock with an owner exists (ENOTEMPTY), and
//             replaces an empty one left by an owner killed while releasing.
//   take over rename `lock/owner-<dead>` to `lock/owner-<me>`. It succeeds for
//             exactly one caller, and only while the dead pid still owns it, so
//             a live lock is never moved or deleted.
//   release   remove `owner-<me>`, then rmdir the lock. rmdir fails on a
//             non-empty directory, so it never removes another owner's lock.
//
// Copies of this script from before #704 used `node_modules.lock` (mkdir, then
// a `pid` file) and took a dead owner's lock by moving it aside, which Greptile
// showed could take a live one. Sharing that directory made every interop rule
// a new race (#704's review), so this protocol has its own path and never
// writes the old one. It only waits, before installing, while an old-format
// lock names a live process. An old copy does not see this lock in return;
// old copies disappear as checkouts move past #704.
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

const LOCK = 'node_modules.install.lock';
const LEGACY_LOCK = 'node_modules.lock';

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

/** The pid holding `lock`, or 0 when there is none (no lock, or an empty one). */
export function ownerOf(lock) {
  try {
    const entry = readdirSync(lock).find((n) => /^owner-\d+$/.test(n));
    return entry ? Number(entry.slice('owner-'.length)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Take `lock` from `deadOwner` for `me`, in one rename of the dead owner's own
 * entry. True for exactly one caller, and only while `deadOwner` still holds it.
 */
export function takeOverFrom(lock, deadOwner, me = process.pid) {
  if (!deadOwner) return false;
  try {
    renameSync(join(lock, `owner-${deadOwner}`), join(lock, `owner-${me}`));
    return true;
  } catch {
    return false; // another caller took it first, or the owner released it
  }
}

/** A live process other than this one named by an old-format lock (before #704), else 0. */
function legacyHolder(dir) {
  try {
    const pid = Number(readFileSync(join(dir, LEGACY_LOCK, 'pid'), 'utf8')) || 0;
    return pid && pid !== process.pid && alive(pid) ? pid : 0;
  } catch {
    return 0;
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
 * Run `action` holding `<dir>/node_modules.install.lock`, or return
 * `{ status: 'busy' }` when another live process still holds it, or an old
 * copy of this script is still installing, after `waitMs`. A dead owner's lock
 * (a hook killed at its timeout) is taken over at once.
 */
export function withInstallLock(dir, waitMs, action) {
  const lock = join(dir, LOCK);
  const candidate = `${lock}.cand-${process.pid}`;
  const deadline = Date.now() + waitMs;
  rmSync(candidate, { recursive: true, force: true });
  mkdirSync(candidate);
  writeFileSync(join(candidate, `owner-${process.pid}`), '');
  let held = false;
  try {
    for (;;) {
      if (!held) {
        try {
          renameSync(candidate, lock);
          held = true;
        } catch (error) {
          if (!['ENOTEMPTY', 'EEXIST', 'ENOTDIR'].includes(error.code)) throw error;
          const owner = ownerOf(lock);
          if (owner && !alive(owner)) held = takeOverFrom(lock, owner);
        }
      }
      if (held && !legacyHolder(dir)) break;
      if (Date.now() >= deadline) return { status: 'busy' };
      sleep(held || ownerOf(lock) ? 500 : 50);
    }
    return action();
  } finally {
    rmSync(candidate, { recursive: true, force: true });
    if (held) release(lock);
  }
}
