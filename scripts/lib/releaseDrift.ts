// Would the next release PR (test -> main) conflict? A release PR squashed onto
// main leaves main with a commit test never had, so the two drift apart and the
// next release PR conflicts in the version files and PRIVACY.md (5.7.2, fixed
// by hand in #702). This asks git, before anything is merged.
//
// `git merge-tree --write-tree` does the real merge in memory and its exit code
// is the answer: 0 clean, 1 conflicts, anything else an error. Trust that, not
// a parse of the messages.
import { spawnSync } from 'node:child_process';

export interface DriftReport {
  /** Files the release PR would conflict in; empty when it merges cleanly. */
  conflicts: string[];
  /**
   * main's tree is exactly the tree of some commit in test's history: main holds
   * nothing test lacks, so syncing with `git merge -s ours` loses nothing.
   */
  mainTreeInTest: boolean;
}

/** Read `git merge-tree --write-tree --name-only --no-messages` output. */
export function parseMergeTree(status: number | null, stdout: string, stderr: string): string[] {
  if (status === 0) return [];
  if (status === 1) {
    // First line is the tree OID; with --name-only and --no-messages every
    // further non-empty line is one conflicted path.
    const [, ...paths] = stdout.split('\n');
    const files = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
    // Exit 1 with no file named still means "conflicts": never report clean.
    return files.length ? files : ['(git reported conflicts but named no file)'];
  }
  throw new Error(
    `git merge-tree exited ${status ?? 'by signal'}: ${stderr.trim() || stdout.trim()}`
  );
}

function git(args: string[], cwd?: string) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function gitOut(args: string[], cwd?: string): string {
  const r = git(args, cwd);
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

export function checkDrift(main = 'origin/main', test = 'origin/test', cwd?: string): DriftReport {
  const r = git(['merge-tree', '--write-tree', '--name-only', '--no-messages', main, test], cwd);
  const conflicts = parseMergeTree(r.status, r.stdout, r.stderr);
  const mainTree = gitOut(['rev-parse', `${main}^{tree}`], cwd);
  const testTrees = gitOut(['log', '--format=%T', test], cwd).split('\n');
  return { conflicts, mainTreeInTest: testTrees.includes(mainTree) };
}
