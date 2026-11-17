import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type BootstrapRepos, git, hookAsApp, makeRepos } from './bootstrapFixture';

let r: BootstrapRepos;
let main: string;
let wt: string;
let testTip: string;
let mergeAnotherPr: () => string;

beforeEach(() => {
  r = makeRepos();
  ({ main, wt, testTip, mergeAnotherPr } = r);
});
afterEach(() => r.cleanup());

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
