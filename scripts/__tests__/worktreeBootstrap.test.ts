import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BootstrapRepos, commit, git, hook, makeRepos } from './bootstrapFixture';

// The SessionStart hook run by hand: no input, so its cwd is the session.
// Run the way Claude desktop runs it: worktreeBootstrapAsApp.test.ts.
let r: BootstrapRepos;
let root: string;
let main: string;
let wt: string;
let testTip: string;
let mergeAnotherPr: () => string;

beforeEach(() => {
  r = makeRepos();
  ({ root, main, wt, testTip, mergeAnotherPr } = r);
});
afterEach(() => r.cleanup());

describe('a session worktree cut from main', () => {
  // A start made from a stale origin/test: the next session start catches up.
  it('catches up with origin/test while it still has nothing of its own', () => {
    hook(wt);
    const tip = mergeAnotherPr();
    hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(tip);
  });

  it('does not move a branch that is not a session branch off an older test commit', () => {
    git(wt, 'checkout', '-q', '-b', 'release-marker', 'origin/test');
    const before = git(wt, 'rev-parse', 'HEAD');
    mergeAnotherPr();
    hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('starts on origin/test when the branch has nothing of its own', () => {
    const out = hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(testTip);
    expect(git(wt, 'symbolic-ref', '--short', 'HEAD')).toBe('claude/session');
    expect(out).toContain('origin/test');
  });

  it('is left alone once the branch has a commit', () => {
    const mine = commit(wt, 'my-work');
    hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(mine);
  });

  it('is left alone while the tree has uncommitted work', () => {
    const before = git(wt, 'rev-parse', 'HEAD');
    writeFileSync(join(wt, 'draft.txt'), 'draft');
    hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('is left alone when checked out detached, the way to read released code', () => {
    git(wt, 'checkout', '-q', '--detach', 'origin/main');
    const before = git(wt, 'rev-parse', 'HEAD');
    hook(wt);
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(before);
  });
});

// Skills, slash commands and hooks are read from the main checkout whatever
// worktree a session works in; it sat 374 commits behind for 54 days.
describe('the main checkout', () => {
  it('follows origin/test while parked (detached)', () => {
    git(main, 'checkout', '-q', '--detach', 'origin/test');
    const tip = mergeAnotherPr();
    hook(wt);
    expect(git(main, 'rev-parse', 'HEAD')).toBe(tip);
  });

  it('is never moved off a branch someone checked out, and the hook says it is behind', () => {
    const before = git(main, 'rev-parse', 'HEAD');
    const out = hook(wt);
    expect(git(main, 'rev-parse', 'HEAD')).toBe(before);
    expect(git(main, 'symbolic-ref', '--short', 'HEAD')).toBe('main');
    expect(out).toMatch(/main checkout is on 'main'.*behind origin\/test/);
  });

  it('still refreshes origin/test for every worktree when it is on a branch', () => {
    const tip = mergeAnotherPr();
    hook(wt);
    expect(git(main, 'rev-parse', 'origin/test')).toBe(tip);
  });

  it('is never moved while it has uncommitted changes to tracked files', () => {
    git(main, 'checkout', '-q', '--detach', 'origin/test');
    const before = git(main, 'rev-parse', 'HEAD');
    writeFileSync(join(main, 'release'), 'edited by hand');
    mergeAnotherPr();
    hook(wt);
    expect(git(main, 'rev-parse', 'HEAD')).toBe(before);
  });

  // "Someone checks out a branch while the fetch runs", made deterministic: the
  // fetch itself does the checkout, through the remote's upload-pack command.
  it('is not detached again when a branch is checked out during the fetch', () => {
    git(main, 'checkout', '-q', '--detach', 'origin/test');
    mergeAnotherPr();
    const switcher = join(root, 'upload-pack.sh');
    writeFileSync(
      switcher,
      `#!/bin/sh\ngit -C "${main}" checkout -q main\nexec git upload-pack "$@"\n`,
      { mode: 0o755 }
    );
    git(main, 'config', 'remote.origin.uploadpack', switcher);
    hook(wt);
    expect(git(main, 'symbolic-ref', '--short', 'HEAD')).toBe('main');
  });

  it('follows origin/test when the session starts in the main checkout itself', () => {
    git(main, 'checkout', '-q', '--detach', 'origin/test');
    const tip = mergeAnotherPr();
    hook(main);
    expect(git(main, 'rev-parse', 'HEAD')).toBe(tip);
  });
});
