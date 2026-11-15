import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDrift, parseMergeTree } from '../releaseDrift';

describe('parseMergeTree', () => {
  it('trusts the exit code: 0 is clean, 1 lists the conflicted files', () => {
    expect(parseMergeTree(0, 'abc123\n', '')).toEqual([]);
    expect(parseMergeTree(1, 'abc123\nPRIVACY.md\npackage.json\n', '')).toEqual([
      'PRIVACY.md',
      'package.json',
    ]);
  });

  it('never reads exit 1 as clean, even with no file named', () => {
    expect(parseMergeTree(1, 'abc123\n', '')).toHaveLength(1);
  });

  it('throws on any other exit (a bad ref), never "clean"', () => {
    expect(() => parseMergeTree(128, '', 'fatal: not a valid object name')).toThrow(/128/);
    expect(() => parseMergeTree(null, '', '')).toThrow(/signal/);
  });
});

// A throwaway repo that replays the 5.7.2 shape: test is squashed onto main,
// then test moves on, and the next release PR conflicts.
let dir = '';
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

function repo() {
  dir = mkdtempSync(join(tmpdir(), 'release-drift-'));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@example.invalid',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.invalid',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      env,
      encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = (file: string, text: string, msg: string) => {
    writeFileSync(join(dir, file), text);
    git('add', file);
    git('commit', '-q', '-m', msg);
  };
  git('init', '-q', '-b', 'main');
  commit('version.txt', '1.0.0\n', 'init');
  git('branch', 'test');
  return { git, commit };
}

describe('checkDrift', () => {
  it('reports the conflict a squashed release leaves behind, and that -s ours is lossless', () => {
    const { git, commit } = repo();
    git('checkout', '-q', 'test');
    commit('version.txt', '1.1.0\n', 'bump 1.1.0');
    // Release PR squashed: main gets test's tree as a new commit test never had.
    git('checkout', '-q', 'main');
    git('merge', '-q', '--squash', 'test');
    git('commit', '-q', '-m', 'Release 1.1.0 (#1)');
    // test moves on and touches the same file.
    git('checkout', '-q', 'test');
    commit('version.txt', '1.2.0\n', 'bump 1.2.0');

    const out = checkDrift('main', 'test', dir);
    expect(out.conflicts).toEqual(['version.txt']);
    expect(out.mainTreeInTest).toBe(true);
    expect(out.mainAheadOfBase).toBe(true);
  });

  it('flags a squashed release before the bump, while merge-tree is still clean', () => {
    // Right after the squash, main and test have the same tree: no conflict
    // yet, but the next bump on test will conflict with the squash.
    const { git, commit } = repo();
    git('checkout', '-q', 'test');
    commit('version.txt', '1.1.0\n', 'bump 1.1.0');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--squash', 'test');
    git('commit', '-q', '-m', 'Release 1.1.0 (#1)');

    const out = checkDrift('main', 'test', dir);
    expect(out.conflicts).toEqual([]);
    expect(out.mainAheadOfBase).toBe(true);
    expect(out.mainTreeInTest).toBe(true);
  });

  it('is clean after a squashed release is synced into test with -s ours', () => {
    const { git, commit } = repo();
    git('checkout', '-q', 'test');
    commit('version.txt', '1.1.0\n', 'bump 1.1.0');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--squash', 'test');
    git('commit', '-q', '-m', 'Release 1.1.0 (#1)');
    git('checkout', '-q', 'test');
    git('merge', '-q', '-s', 'ours', '-m', 'sync', 'main');
    commit('version.txt', '1.2.0\n', 'bump 1.2.0');

    const out = checkDrift('main', 'test', dir);
    expect(out.conflicts).toEqual([]);
    expect(out.mainAheadOfBase).toBe(false);
  });

  it('is clean after a release merged with a merge commit', () => {
    const { git, commit } = repo();
    git('checkout', '-q', 'test');
    commit('version.txt', '1.1.0\n', 'bump 1.1.0');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', '-m', 'Release 1.1.0', 'test');
    git('checkout', '-q', 'test');
    commit('version.txt', '1.2.0\n', 'bump 1.2.0');

    const out = checkDrift('main', 'test', dir);
    expect(out.conflicts).toEqual([]);
    expect(out.mainAheadOfBase).toBe(false);
  });

  it('says so when main holds something test lacks', () => {
    const { git, commit } = repo();
    git('checkout', '-q', 'main');
    commit('version.txt', 'hotfix on main\n', 'hotfix');
    git('checkout', '-q', 'test');
    commit('version.txt', '1.1.0\n', 'bump 1.1.0');

    const out = checkDrift('main', 'test', dir);
    expect(out.conflicts).toEqual(['version.txt']);
    expect(out.mainTreeInTest).toBe(false);
  });

  it('throws on a ref that does not exist instead of reporting clean', () => {
    repo();
    expect(() => checkDrift('nope', 'test', dir)).toThrow();
  });
});
