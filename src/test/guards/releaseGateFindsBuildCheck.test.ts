import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The Release gate looks up CI's `Build web preview` run on the release
 * commit. GitHub's check-runs list is paged at 30, and a release commit
 * collects runs fast: every edit of the release PR's body adds three (the
 * checklist, the privacy block and the gate itself). On 5.8.0 (#731, 36 runs)
 * the build run fell off the first page and the gate said it "has not
 * reported" for a commit it had passed. So the gate asks GitHub for that one
 * check by name, latest run only, instead of scanning a page.
 */
const gate = readFileSync(join(__dirname, '../../../.github/workflows/release-gate.yml'), 'utf8');

describe('Release gate finds Build web preview however many checks the commit has', () => {
  it('filters the check-runs request by name on the server', () => {
    expect(gate).toMatch(/check-runs[\s\S]{0,200}check_name=/);
    expect(gate).toMatch(/filter=latest/);
  });

  it('does not read an unfiltered page of check runs', () => {
    expect(gate).not.toMatch(/commits\/\$HEAD_SHA\/check-runs"/);
  });
});
