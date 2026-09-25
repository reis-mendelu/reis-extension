import { describe, expect, it } from 'vitest';
// @ts-expect-error - plain .mjs build helper, no types
import { parseOnlyIds } from '../onlyIds.mjs';

// fetch-landmarks / fetch-remote-places rewrite a committed data file. A
// malformed --only must stop the run, not fall through to a FULL fetch (every
// hand-trimmed outline regenerated) or to an empty one that reports success.
describe('parseOnlyIds', () => {
  const known = [-101, -102, -201];

  it('is null when the flag is absent — a full run', () => {
    expect(parseOnlyIds(['node', 'x.mjs'], known)).toBeNull();
  });

  it('reads a comma list of known ids', () => {
    expect(parseOnlyIds(['--only=-101,-201'], known)).toEqual([-101, -201]);
  });

  it.each([
    ['--only', 'the flag with no ids'],
    ['--only=', 'an empty list'],
    ['--only=-101,,', 'an empty entry'],
    ['--only=abc', 'a non-number'],
    ['--only=-999', 'an id the script does not know'],
  ])('refuses %s (%s)', (arg) => {
    expect(() => parseOnlyIds([arg], known)).toThrow(/--only/);
  });
});
