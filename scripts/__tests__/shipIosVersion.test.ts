import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Which App Store version the ship pipeline's iOS job asks about.
 *
 * A dry run (ship-dryrun.yml) passes the LATEST EXISTING tag, because the
 * extension leg builds from a tag. The iOS leg used to submit that tag's version
 * too, so on the 5.8.0 release PR it asked about 5.7.2 and found 5.8.0's own
 * draft (PREPARE_FOR_SUBMISSION, made ahead by /release) as "another version
 * being edited": red on every release PR. A dry run checks the version the PR
 * would release, which is package.json at the ref it built; a real release
 * submits its tag.
 *
 * A text scan scoped to the ios job, like src/test/guards/ciGatesStayRepoWide.
 */
function iosJob(): string {
  const text = readFileSync(join(__dirname, '../../.github/workflows/ship.yml'), 'utf8');
  const start = text.indexOf('\n  ios:\n');
  expect(start, 'ship.yml has no top-level job "ios"').toBeGreaterThan(-1);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[A-Za-z0-9_-]+:/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('ship.yml iOS version', () => {
  it('a dry run reads the version from package.json, a release from its tag', () => {
    const job = iosJob();
    expect(job).toContain(`node -p "require('./package.json').version"`);
    expect(job).toMatch(/if \[ "\$DRY_RUN" = true \]/);
    expect(job).toContain('v="${TAG#v}"');
  });

  it('every ios-submit.ts call uses that one resolved version', () => {
    const calls = iosJob().match(/ios-submit\.ts[^\n]*\n?[^\n]*/g) ?? [];
    expect(calls.length).toBe(2);
    for (const c of calls) {
      expect(c).toContain('--version "$VERSION"');
      expect(c).not.toContain('TAG#v');
    }
  });
});
