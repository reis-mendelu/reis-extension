import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

export const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/** The hook run by hand, or by a test: no input, the cwd is the session. */
export const hook = (cwd: string) => execFileSync('bash', [HOOK], { cwd, env, encoding: 'utf8' });

/**
 * How Claude desktop really runs it: the app passes --project-config-root <main
 * checkout>, so the hook's process cwd (and $CLAUDE_PROJECT_DIR) is the MAIN
 * checkout. Only the hook input on stdin names the session's own worktree.
 */
export const hookAsApp = (main: string, sessionCwd: string, event: string, ...args: string[]) =>
  execFileSync('bash', [HOOK, ...args], {
    cwd: main,
    env,
    encoding: 'utf8',
    input: JSON.stringify({ session_id: 's1', cwd: sessionCwd, hook_event_name: event }),
  });

export const commit = (cwd: string, file: string) => {
  writeFileSync(join(cwd, file), file);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-q', '-m', file);
  return git(cwd, 'rev-parse', 'HEAD');
};

export interface BootstrapRepos {
  root: string;
  seed: string;
  main: string;
  wt: string;
  testTip: string;
  /** Lands one more commit on origin/test and returns it. */
  mergeAnotherPr: () => string;
  cleanup: () => void;
}

export const makeRepos = (): BootstrapRepos => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reis-bootstrap-')));
  const seed = join(root, 'seed');
  const main = join(root, 'main');
  const wt = join(root, 'wt');
  git(root, 'init', '-q', '-b', 'main', seed);
  commit(seed, 'release');
  git(seed, 'checkout', '-q', '-b', 'test');
  const testTip = commit(seed, 'merged-pr');
  git(root, 'clone', '-q', '--bare', seed, join(root, 'origin.git'));
  git(seed, 'remote', 'add', 'origin', join(root, 'origin.git'));
  git(root, 'clone', '-q', '-b', 'main', join(root, 'origin.git'), main);
  git(main, 'worktree', 'add', '-q', '-b', 'claude/session', wt, 'origin/main');
  const mergeAnotherPr = () => {
    const tip = commit(seed, 'another-pr');
    git(seed, 'push', '-q', 'origin', 'test');
    return tip;
  };
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  return { root, seed, main, wt, testTip, mergeAnotherPr, cleanup };
};
