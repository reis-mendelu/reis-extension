import { describe, it, expect, afterEach, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const LOCK_MODULE = resolve(__dirname, '../installLock.mjs');

/** A pid that has certainly exited: a child we ran to completion. */
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid!;

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'install-lock-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const takeLock = (lock: string, pid: number) => {
  mkdirSync(lock);
  writeFileSync(join(lock, 'pid'), String(pid));
};
const ownerOf = (lock: string) => Number(readFileSync(join(lock, 'pid'), 'utf8'));

describe('clearDeadLock', () => {
  // Greptile on #703: two callers saw the same dead owner. The first cleared it
  // and took the lock; the second then moved that LIVE lock aside, a third
  // caller slipped into the gap, the move back failed, and the live lock was
  // deleted, so two installs ran over one node_modules.incoming.
  it('never moves or deletes a lock a live process took after the dead owner', async () => {
    const { clearDeadLock } = await import(LOCK_MODULE);
    const lock = join(tempDir(), 'node_modules.lock');
    takeLock(lock, process.pid); // caller A, alive, already holds it

    clearDeadLock(lock, deadPid()); // caller B, acting on what it saw a moment ago

    expect(existsSync(lock)).toBe(true);
    expect(ownerOf(lock)).toBe(process.pid);
  });

  it('removes the lock while it still names the dead owner', async () => {
    const { clearDeadLock } = await import(LOCK_MODULE);
    const lock = join(tempDir(), 'node_modules.lock');
    const dead = deadPid();
    takeLock(lock, dead);

    clearDeadLock(lock, dead);

    expect(existsSync(lock)).toBe(false);
    expect(existsSync(`${lock}.takeover`)).toBe(false);
  });

  it('leaves the lock alone while another caller is clearing it', async () => {
    const { clearDeadLock } = await import(LOCK_MODULE);
    const lock = join(tempDir(), 'node_modules.lock');
    const dead = deadPid();
    takeLock(lock, dead);
    mkdirSync(`${lock}.takeover`); // someone else holds the takeover right now

    clearDeadLock(lock, dead);

    expect(ownerOf(lock)).toBe(dead);
  });
});

describe('withInstallLock, competing callers', () => {
  // Real processes, so the interleaving is the operating system's, not ours.
  it('lets exactly one install run at a time after a dead owner', async () => {
    const dir = tempDir();
    takeLock(join(dir, 'node_modules.lock'), deadPid());
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
    expect(existsSync(join(dir, 'node_modules.lock'))).toBe(false);
  }, 30_000);
});
