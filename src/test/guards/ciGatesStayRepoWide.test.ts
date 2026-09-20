import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

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

// A text scan, like the other guards here: no YAML parser, so no types package
// for one fence. The strings below are exact lines from the workflow files.
const read = (file: string) => readFileSync(join(WORKFLOWS, file), 'utf8');

describe('CI lint and format gates', () => {
  it('lints the whole repo, not just the files a PR touched', () => {
    const ci = read('ci.yml');
    expect(ci).toContain('run: npm run lint -- --max-warnings=0');
    expect(ci).not.toContain('git diff --name-only');
  });

  it('checks formatting across the whole repo', () => {
    const format = read('format.yml');
    expect(format).toContain('run: npm run format:check');
    expect(format).not.toContain('git diff --name-only');
  });

  it('keeps the two job names branch protection requires verbatim', () => {
    // Changing either string means editing the required-status-check list on
    // BOTH `test` and `main` in the same change, or PRs hang. See the header.
    expect(read('ci.yml')).toContain('name: UI/UX gate (changed files)');
    expect(read('format.yml')).toContain('name: Format (changed files)');
  });
});
