import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// The two Stop hooks, run the way Claude desktop runs them. The app starts
// every session with --project-config-root <main checkout>, so a project hook's
// process cwd (and $CLAUDE_PROJECT_DIR) is the MAIN checkout; only the hook
// input's `cwd` names the session's worktree (PR #715). A hook that runs git in
// its own cwd inspects the main checkout, finds nothing, and exits 0 — which
// looks exactly like a pass.
const HOOKS = resolve(__dirname, '../../.claude/hooks');
const TREE_PARITY = join(HOOKS, 'tree-parity.mjs');
const DISCLOSURE_DRIFT = join(HOOKS, 'disclosure-drift.mjs');

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'reIS test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'reIS test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const write = (dir: string, file: string, text: string) => {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
};
/** Runs a hook as the app does: process cwd `processCwd`, `input` on stdin. */
const run = (hookPath: string, processCwd: string, input: object | null) => {
  const r = spawnSync('node', [hookPath], {
    cwd: processCwd,
    env,
    encoding: 'utf8',
    input: input === null ? '' : JSON.stringify(input),
  });
  return { status: r.status, stderr: r.stderr };
};
const stopInput = (cwd: string) => ({ session_id: 's1', cwd, hook_event_name: 'Stop' });

// The smallest repo both hooks recognise: two UI trees whose closures each
// reach more than one module, and a disclosures source with one flow file.
const FIXTURE: Record<string, string> = {
  'src/components/mobile/MobileApp.tsx': "import { a } from './MobileHome';\nexport const m = a;\n",
  'src/components/mobile/MobileHome.tsx': "import { s } from '../Shared';\nexport const a = s;\n",
  'src/components/Sidebar.tsx': "import { d } from './DesktopPanel';\nexport const x = d;\n",
  'src/components/DesktopPanel.tsx': "import { s } from './Shared';\nexport const d = s;\n",
  'src/components/AppMain.tsx': "import { s } from './Shared';\nexport const y = s;\n",
  'src/components/AppOverlays.tsx': "import { s } from './Shared';\nexport const z = s;\n",
  'src/components/Shared.tsx': 'export const s = 1;\n',
  'src/api/suggestions.ts': 'export const send = 1;\n',
  'privacy/disclosures.ts': "export const flows = [{ files: ['src/api/suggestions.ts'] }];\n",
};

let root: string;
let main: string;
let wt: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'reis-stop-hooks-')));
  const seed = join(root, 'seed');
  main = join(root, 'main');
  wt = join(root, 'wt');
  git(root, 'init', '-q', '-b', 'main', seed);
  for (const [file, text] of Object.entries(FIXTURE)) write(seed, file, text);
  git(seed, 'add', '.');
  git(seed, 'commit', '-q', '-m', 'release');
  git(seed, 'branch', 'test');
  git(root, 'clone', '-q', '--bare', seed, join(root, 'origin.git'));
  git(root, 'clone', '-q', '-b', 'main', join(root, 'origin.git'), main);
  git(main, 'worktree', 'add', '-q', '-b', 'claude/session', wt, 'origin/test');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const markerIn = (checkout: string, name: string) =>
  existsSync(join(git(checkout, 'rev-parse', '--absolute-git-dir'), name));

describe('tree-parity acts on the session worktree, not the main checkout', () => {
  const touchDesktopOnly = () =>
    write(
      wt,
      'src/components/DesktopPanel.tsx',
      "import { s } from './Shared';\nexport const d = s + 1;\n"
    );

  it('refuses a one-tree change made in the worktree', () => {
    touchDesktopOnly();
    const r = run(TREE_PARITY, main, stopInput(wt));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('DESKTOP tree only');
    expect(r.stderr).toContain('src/components/DesktopPanel.tsx');
  });

  it('classifies against the worktree import graph, so a new file wired up there counts', () => {
    write(wt, 'src/components/mobile/NewSheet.tsx', 'export const n = 1;\n');
    write(
      wt,
      'src/components/mobile/MobileHome.tsx',
      "import { s } from '../Shared';\nimport { n } from './NewSheet';\nexport const a = s + n;\n"
    );
    const r = run(TREE_PARITY, main, stopInput(wt));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('src/components/mobile/NewSheet.tsx');
  });

  it('keeps its ask-once marker in the worktree, so one session cannot silence another', () => {
    touchDesktopOnly();
    run(TREE_PARITY, main, stopInput(wt));
    expect(markerIn(wt, 'reis-tree-parity')).toBe(true);
    expect(markerIn(main, 'reis-tree-parity')).toBe(false);
    // Asked once: the same set of files ends the turn the second time.
    expect(run(TREE_PARITY, main, stopInput(wt)).status).toBe(0);
  });

  it('resolves a subdirectory cwd to the worktree root', () => {
    touchDesktopOnly();
    expect(run(TREE_PARITY, main, stopInput(join(wt, 'src/components'))).status).toBe(2);
  });

  it('falls back to its own cwd when there is no input', () => {
    touchDesktopOnly();
    expect(run(TREE_PARITY, wt, null).status).toBe(2);
  });

  it('stays quiet when the worktree changed nothing, however dirty the main checkout is', () => {
    write(main, 'src/components/DesktopPanel.tsx', 'export const d = 2;\n');
    expect(run(TREE_PARITY, main, stopInput(wt)).status).toBe(0);
  });
});

describe('disclosure-drift acts on the session worktree, not the main checkout', () => {
  const touchFlow = () => write(wt, 'src/api/suggestions.ts', 'export const send = 2;\n');

  it('asks about a data-flow change made in the worktree', () => {
    touchFlow();
    const r = run(DISCLOSURE_DRIFT, main, stopInput(wt));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('src/api/suggestions.ts');
  });

  it('sees a committed migration on the session branch', () => {
    write(wt, 'supabase/migrations/20261117000000_x.sql', 'select 1;\n');
    git(wt, 'add', '.');
    git(wt, 'commit', '-q', '-m', 'migration');
    const r = run(DISCLOSURE_DRIFT, main, stopInput(wt));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('supabase/migrations/20261117000000_x.sql');
  });

  it('reads the disclosures source from the worktree, where it was updated', () => {
    touchFlow();
    write(
      wt,
      'privacy/disclosures.ts',
      "export const flows = [{ files: ['src/api/suggestions.ts'] }]; // v2\n"
    );
    expect(run(DISCLOSURE_DRIFT, main, stopInput(wt)).status).toBe(0);
  });

  it('keeps its ask-once marker in the worktree', () => {
    touchFlow();
    run(DISCLOSURE_DRIFT, main, stopInput(wt));
    expect(markerIn(wt, 'reis-disclosure-drift')).toBe(true);
    expect(markerIn(main, 'reis-disclosure-drift')).toBe(false);
  });

  it('resolves a subdirectory cwd to the worktree root', () => {
    touchFlow();
    expect(run(DISCLOSURE_DRIFT, main, stopInput(join(wt, 'src'))).status).toBe(2);
  });

  it('falls back to its own cwd when there is no input', () => {
    touchFlow();
    expect(run(DISCLOSURE_DRIFT, wt, null).status).toBe(2);
  });

  it('stays quiet when the worktree changed nothing, however dirty the main checkout is', () => {
    write(main, 'src/api/suggestions.ts', 'export const send = 3;\n');
    expect(run(DISCLOSURE_DRIFT, main, stopInput(wt)).status).toBe(0);
  });
});
