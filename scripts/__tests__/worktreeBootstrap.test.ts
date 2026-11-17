import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The SessionStart hook, run against throwaway repositories: a bare `origin`
// with `main` (the last release) and `test` ahead of it, a main checkout, and a
// session worktree cut from main — the layout every Claude session starts in.
const HOOK = resolve(__dirname, '../../.claude/hooks/worktree-bootstrap.sh');

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'reIS test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'reIS test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  // The hook moves the main checkout in the background; a test has to see it.
  REIS_BOOTSTRAP_SYNC: '1',
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const hook = (cwd: string) => execFileSync('bash', [HOOK], { cwd, env, encoding: 'utf8' });
// How Claude desktop really runs it: the app passes --project-config-root <main
// checkout>, so the hook's process cwd (and $CLAUDE_PROJECT_DIR) is the MAIN
// checkout. Only the hook input on stdin names the session's own worktree.
const hookAsApp = (main: string, sessionCwd: string, event: string, ...args: string[]) =>
  execFileSync('bash', [HOOK, ...args], {
    cwd: main,
    env,
    encoding: 'utf8',
    input: JSON.stringify({ session_id: 's1', cwd: sessionCwd, hook_event_name: event }),
  });
const commit = (cwd: string, file: string) => {
  writeFileSync(join(cwd, file), file);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-q', '-m', file);
  return git(cwd, 'rev-parse', 'HEAD');
};

let root: string;
let seed: string;
let main: string;
let wt: string;
let testTip: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'reis-bootstrap-')));
  seed = join(root, 'seed');
  main = join(root, 'main');
  wt = join(root, 'wt');
  git(root, 'init', '-q', '-b', 'main', seed);
  commit(seed, 'release');
  git(seed, 'checkout', '-q', '-b', 'test');
  testTip = commit(seed, 'merged-pr');
  git(root, 'clone', '-q', '--bare', seed, join(root, 'origin.git'));
  git(seed, 'remote', 'add', 'origin', join(root, 'origin.git'));
  git(root, 'clone', '-q', '-b', 'main', join(root, 'origin.git'), main);
  git(main, 'worktree', 'add', '-q', '-b', 'claude/session', wt, 'origin/main');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const mergeAnotherPr = () => {
  const tip = commit(seed, 'another-pr');
  git(seed, 'push', '-q', 'origin', 'test');
  return tip;
};

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

// Since at least 2026-10-20 Claude desktop runs project hooks from the main
// checkout. A hook that took the repository from its own cwd saw the main
// checkout, returned silently, and left every session worktree on main.
describe('run the way Claude desktop runs it (cwd = main checkout)', () => {
  it('takes the session worktree from the hook input, not from its cwd', () => {
    const out = hookAsApp(main, wt, 'SessionStart');
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(testTip);
    expect(out).toContain('origin/test');
  });

  it('finds the worktree when the session cwd is a subdirectory of it', () => {
    const sub = join(wt, 'sub');
    mkdirSync(sub);
    hookAsApp(main, sub, 'SessionStart');
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(testTip);
  });

  // A worktree the app reuses can still be detached when SessionStart runs and
  // get its session branch a moment later; the first prompt catches it.
  it('moves a branch checked out after SessionStart by the first prompt', () => {
    git(wt, 'checkout', '-q', '--detach', 'origin/main');
    hookAsApp(main, wt, 'SessionStart');
    expect(git(wt, 'rev-parse', 'HEAD')).not.toBe(testTip);
    git(wt, 'checkout', '-q', '-b', 'claude/next', 'origin/main');
    const out = hookAsApp(main, wt, 'UserPromptSubmit', '--first-prompt');
    expect(git(wt, 'symbolic-ref', '--short', 'HEAD')).toBe('claude/next');
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(testTip);
    expect(out).toContain('origin/test');
  });

  it('acts on a prompt at most once per branch, silently, and never fetches', () => {
    expect(hookAsApp(main, wt, 'UserPromptSubmit', '--first-prompt')).toContain('origin/test');
    const remoteTip = mergeAnotherPr();
    expect(hookAsApp(main, wt, 'UserPromptSubmit', '--first-prompt')).toBe('');
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(testTip);
    expect(git(main, 'rev-parse', 'origin/test')).not.toBe(remoteTip);
  });

  it('keeps every safety condition on the prompt check', () => {
    writeFileSync(join(wt, 'draft.txt'), 'draft');
    const before = git(wt, 'rev-parse', 'HEAD');
    expect(hookAsApp(main, wt, 'UserPromptSubmit', '--first-prompt')).toBe('');
    expect(git(wt, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('does nothing on a prompt in the main checkout itself', () => {
    const before = git(main, 'rev-parse', 'HEAD');
    expect(hookAsApp(main, main, 'UserPromptSubmit', '--first-prompt')).toBe('');
    expect(git(main, 'rev-parse', 'HEAD')).toBe(before);
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
