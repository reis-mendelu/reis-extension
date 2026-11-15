import { describe, it, expect, afterEach } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const LOCK_MODULE = resolve(__dirname, '../installLock.mjs');
const LOCK = 'node_modules.install.lock';

/** A pid that has certainly exited: a child we ran to completion. */
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid!;
/** A pid that is certainly alive and is not this process. */
const livePid = () => process.ppid;

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'install-lock-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A lock as the module writes it: a directory holding one `owner-<pid>` entry. */
const lockOwnedBy = (lock: string, pid: number) => {
  mkdirSync(lock);
  writeFileSync(join(lock, `owner-${pid}`), '');
};

describe('takeOverFrom', () => {
  // Greptile on #703 and #704: a caller acting on a "dead owner" it saw a
  // moment ago moved or deleted a lock a live process had taken since. The
  // takeover is one rename of the dead owner's own entry, so it cannot touch
  // any other owner's lock.
  it('cannot take a lock a live process holds, whatever the caller saw before', async () => {
    const { takeOverFrom } = await import(LOCK_MODULE);
    const lock = join(tempDir(), LOCK);
    const live = livePid();
    lockOwnedBy(lock, live);

    expect(takeOverFrom(lock, deadPid(), 4242)).toBe(false);
    expect(readdirSync(lock)).toEqual([`owner-${live}`]);
  });

  it('gives a dead owner lock to exactly one of the callers that saw it dead', async () => {
    const { takeOverFrom } = await import(LOCK_MODULE);
    const lock = join(tempDir(), LOCK);
    const dead = deadPid();
    lockOwnedBy(lock, dead);

    expect(takeOverFrom(lock, dead, 1111)).toBe(true);
    expect(takeOverFrom(lock, dead, 2222)).toBe(false);
    expect(readdirSync(lock)).toEqual(['owner-1111']);
  });
});

describe('withInstallLock', () => {
  it('replaces an empty lock left by an owner killed while releasing', async () => {
    const { withInstallLock } = await import(LOCK_MODULE);
    const dir = tempDir();
    mkdirSync(join(dir, LOCK));

    expect(withInstallLock(dir, 1000, () => 'ran')).toBe('ran');
    expect(existsSync(join(dir, LOCK))).toBe(false);
  });

  it('waits for a live owner, then reports busy, and leaves its lock alone', async () => {
    const { withInstallLock } = await import(LOCK_MODULE);
    const dir = tempDir();
    lockOwnedBy(join(dir, LOCK), livePid());

    expect(withInstallLock(dir, 300, () => 'ran')).toEqual({ status: 'busy' });
    expect(readdirSync(join(dir, LOCK))).toEqual([`owner-${livePid()}`]);
    expect(readdirSync(dir).filter((n) => n.includes('.cand-'))).toEqual([]);
  });

  // #704's review: sharing `node_modules.lock` with copies from before this PR
  // made every interop rule a new race, so the new protocol never touches it.
  describe('an old-format lock (node_modules.lock with a pid file)', () => {
    const legacy = (dir: string, pid: number) => {
      mkdirSync(join(dir, 'node_modules.lock'));
      writeFileSync(join(dir, 'node_modules.lock', 'pid'), String(pid));
    };

    it('is waited for while it names a live process, and left untouched', async () => {
      const { withInstallLock } = await import(LOCK_MODULE);
      const dir = tempDir();
      legacy(dir, livePid());

      expect(withInstallLock(dir, 300, () => 'ran')).toEqual({ status: 'busy' });
      expect(readFileSync(join(dir, 'node_modules.lock', 'pid'), 'utf8')).toBe(String(livePid()));
      expect(existsSync(join(dir, LOCK))).toBe(false);
    });

    it('does not block once its process is gone, and is still left untouched', async () => {
      const { withInstallLock } = await import(LOCK_MODULE);
      const dir = tempDir();
      const dead = deadPid();
      legacy(dir, dead);

      expect(withInstallLock(dir, 1000, () => 'ran')).toBe('ran');
      expect(readFileSync(join(dir, 'node_modules.lock', 'pid'), 'utf8')).toBe(String(dead));
    });
  });

  // Real processes, so the interleaving is the operating system's, not ours.
  it('lets exactly one install run at a time after a dead owner', async () => {
    const dir = tempDir();
    lockOwnedBy(join(dir, LOCK), deadPid());
    const log = join(dir, 'log');
    writeFileSync(log, '');
    const script = `
      import { appendFileSync } from 'node:fs';
      import { withInstallLock } from ${JSON.stringify(LOCK_MODULE)};
      const r = withInstallLock(${JSON.stringify(dir)}, 30000, () => {
        appendFileSync(${JSON.stringify(log)}, 'start ' + process.pid + '\\n');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
        appendFileSync(${JSON.stringify(log)}, 'end ' + process.pid + '\\n');
      });
      if (r && r.status === 'busy') process.exit(3);
    `;
    const runs = Array.from(
      { length: 5 },
      () =>
        new Promise<number>((done) => {
          const child = spawn(process.execPath, ['--input-type=module', '-e', script]);
          child.on('exit', (code) => done(code ?? -1));
        })
    );
    expect(await Promise.all(runs)).toEqual([0, 0, 0, 0, 0]);

    const lines = readFileSync(log, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(10);
    // Strictly start/end pairs of the same pid: no install overlapped another.
    for (let i = 0; i < lines.length; i += 2) {
      const [a, pidA] = lines[i]!.split(' ');
      const [b, pidB] = lines[i + 1]!.split(' ');
      expect([a, b, pidA]).toEqual(['start', 'end', pidB]);
    }
    expect(existsSync(join(dir, LOCK))).toBe(false);
  }, 30_000);
});
