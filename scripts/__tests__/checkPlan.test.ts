import { describe, it, expect } from 'vitest';
import { closestBase, planFromChanges, staleInstall, verdict } from '../lib/checkPlan.mjs';

const lock = {
  packages: {
    '': { name: 'reis' },
    'node_modules/vitest': { version: '5.0.1' },
    'node_modules/react': { version: '19.2.0' },
    'node_modules/@esbuild/linux-x64': { version: '0.25.0', optional: true },
    'node_modules/@reis/capacitor-eduroam': { resolved: 'native/capacitor-eduroam', link: true },
    'native/capacitor-eduroam': { version: '1.0.0' },
  },
};

describe('staleInstall', () => {
  it('is empty when every installed version is the locked one', () => {
    const installed = {
      packages: {
        'node_modules/vitest': { version: '5.0.1' },
        'node_modules/react': { version: '19.2.0' },
      },
    };
    expect(staleInstall(lock, installed)).toEqual([]);
  });

  // The failure this exists for: a worktree copied from an old install kept
  // vitest 3 under a lockfile that pins 5, and reported real-looking errors.
  it('names a package installed at another version', () => {
    const installed = {
      packages: {
        'node_modules/vitest': { version: '3.2.7' },
        'node_modules/react': { version: '19.2.0' },
      },
    };
    expect(staleInstall(lock, installed)).toEqual([
      { name: 'vitest', want: '5.0.1', have: '3.2.7' },
    ]);
  });

  it('names a locked package that is not installed', () => {
    const installed = { packages: { 'node_modules/vitest': { version: '5.0.1' } } };
    expect(staleInstall(lock, installed)).toEqual([{ name: 'react', want: '19.2.0', have: null }]);
  });

  // npm skips another platform's binaries, so their absence is a correct install.
  it('does not count an optional package that is absent', () => {
    const installed = {
      packages: {
        'node_modules/vitest': { version: '5.0.1' },
        'node_modules/react': { version: '19.2.0' },
      },
    };
    expect(staleInstall(lock, installed).map((p) => p.name)).not.toContain('@esbuild/linux-x64');
  });

  it('treats no install at all as everything missing', () => {
    expect(staleInstall(lock, null).map((p) => p.name)).toEqual(['vitest', 'react']);
  });
});

describe('planFromChanges', () => {
  const guards = ['src/test/guards/a.test.ts', 'src/test/guards/b.test.ts'];

  it('lints only what eslint is configured for, and format-checks everything', () => {
    const plan = planFromChanges(['src/a.ts', 'src/b.tsx', 'scripts/c.mjs', 'docs/d.md'], guards);
    expect(plan.lint).toEqual(['src/a.ts', 'src/b.tsx']);
    expect(plan.format).toEqual(['src/a.ts', 'src/b.tsx', 'scripts/c.mjs', 'docs/d.md']);
  });

  // Guards read files through fs, so no import graph relates them to a change:
  // they run every time, or a docs-only edit that breaks one passes locally.
  it('always runs the guard tests, even for a docs-only change', () => {
    const plan = planFromChanges(['PRIVACY.md'], guards);
    expect(plan.tests).toEqual(guards);
  });

  it('asks vitest for the tests related to changed code, without duplicates', () => {
    const plan = planFromChanges(
      ['src/a.ts', 'src/test/guards/a.test.ts', 'package.json', 'README.md'],
      guards
    );
    expect(plan.tests).toEqual([
      'src/a.ts',
      'src/test/guards/a.test.ts',
      'package.json',
      'src/test/guards/b.test.ts',
    ]);
  });
});

describe('closestBase', () => {
  it('picks the base the branch has the fewest commits on top of', () => {
    expect(
      closestBase([
        { ref: 'origin/test', sha: 'aaa', ahead: 2 },
        { ref: 'origin/main', sha: 'bbb', ahead: 40 },
      ])
    ).toMatchObject({ ref: 'origin/test', sha: 'aaa' });
  });

  it('prefers test when both are equally close', () => {
    expect(
      closestBase([
        { ref: 'origin/main', sha: 'bbb', ahead: 0 },
        { ref: 'origin/test', sha: 'aaa', ahead: 0 },
      ])?.ref
    ).toBe('origin/test');
  });

  it('is null when neither base is known', () => {
    expect(closestBase([])).toBeNull();
  });
});

describe('verdict', () => {
  it('passes only when every step passed, and says what ran', () => {
    expect(
      verdict([
        { step: 'install', ok: true },
        { step: 'typecheck', ok: true },
        { step: 'tests', ok: true, detail: '12 files' },
      ])
    ).toBe('check: PASS (install, typecheck, tests: 12 files)');
  });

  it('names every failed step', () => {
    expect(
      verdict([
        { step: 'typecheck', ok: true },
        { step: 'nuia', ok: false },
        { step: 'tests', ok: false },
      ])
    ).toBe('check: FAIL (nuia, tests) — passed: typecheck');
  });

  // A run that did nothing must not read as a pass.
  it('fails when nothing ran', () => {
    expect(verdict([])).toBe('check: FAIL (nothing ran)');
  });
});
