import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

/**
 * CI guard for the lint/format gates, which have two failure modes that are
 * both silent.
 *
 * 1. THE GATE QUIETLY NARROWS. Both gates used to lint only the files a PR
 *    touched, which let 31 lint errors and 349 unformatted files accumulate
 *    where nobody could see them — test files were excluded outright, and the
 *    format globs never covered .html/.js/.mjs. The backlog was swept; a
 *    changed-files gate would start it over and the board would stay green
 *    the whole time.
 *
 * 2. THE JOB IS RENAMED. Branch protection on `test` and `main` requires these
 *    two contexts by their exact strings. A workflow that renames a job keeps
 *    passing on its own branch while every PR hangs forever on a required
 *    check that no longer reports — which looks like a GitHub outage, not a
 *    typo. The names below are therefore load-bearing and read as wrong: they
 *    still say "(changed files)" precisely because the required-check lists
 *    say so, and the two can only change together.
 */

const WORKFLOWS = join(__dirname, '../../../.github/workflows');

function job(file: string, id: string) {
  const doc = load(readFileSync(join(WORKFLOWS, file), 'utf8')) as {
    jobs: Record<string, { name?: string; steps?: { run?: string }[] }>;
  };
  const found = doc.jobs[id];
  expect(found, `${file} has no job "${id}"`).toBeDefined();
  return { name: found!.name, runs: (found!.steps ?? []).map((s) => s.run ?? '').join('\n') };
}

describe('CI lint and format gates', () => {
  it('lints the whole repo, not just the files a PR touched', () => {
    const { runs } = job('ci.yml', 'ui-gate');
    expect(runs).toContain('npm run lint -- --max-warnings=0');
    expect(runs).not.toContain('git diff --name-only');
  });

  it('checks formatting across the whole repo', () => {
    const { runs } = job('format.yml', 'format-gate');
    expect(runs).toContain('npm run format:check');
    expect(runs).not.toContain('git diff --name-only');
  });

  it('keeps the two job names branch protection requires verbatim', () => {
    // Changing either string means editing the required-status-check list on
    // BOTH `test` and `main` in the same change, or PRs hang. See the header.
    expect(job('ci.yml', 'ui-gate').name).toBe('UI/UX gate (changed files)');
    expect(job('format.yml', 'format-gate').name).toBe('Format (changed files)');
  });
});
