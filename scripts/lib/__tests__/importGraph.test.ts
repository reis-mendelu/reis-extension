import { describe, it, expect } from 'vitest';
import { collectImportGraph, chainToPackage, type GraphHost } from '../importGraph';

/** In-memory host: `files` maps an absolute-ish path to its source. */
function hostFor(files: Record<string, string>): GraphHost {
  return {
    read: (f) => files[f] ?? null,
    resolve: (spec, from) => {
      if (!spec.startsWith('.')) return null; // bare package
      const dir = from.slice(0, from.lastIndexOf('/'));
      const path = `${dir}/${spec.replace(/^\.\//, '')}.ts`;
      return path in files ? path : null;
    },
  };
}

describe('collectImportGraph', () => {
  it('walks static imports and records bare packages with their importers', () => {
    const host = hostFor({
      '/a/entry.ts': `import { b } from './b';\nimport x from 'pkg-one';`,
      '/a/b.ts': `import y from 'pkg-two';`,
    });
    const g = collectImportGraph('/a/entry.ts', host);

    expect(g.files.sort()).toEqual(['/a/b.ts', '/a/entry.ts']);
    expect(g.packages.get('pkg-one')).toEqual(['/a/entry.ts']);
    expect(g.packages.get('pkg-two')).toEqual(['/a/b.ts']);
  });

  it('records a side-effect-only import', () => {
    const host = hostFor({ '/a/entry.ts': `import 'polyfill-pkg';` });
    expect(collectImportGraph('/a/entry.ts', host).packages.has('polyfill-pkg')).toBe(true);
  });

  it('survives a cycle without hanging', () => {
    const host = hostFor({
      '/a/entry.ts': `import './b';`,
      '/a/b.ts': `import './entry';\nimport z from 'pkg';`,
    });
    expect(collectImportGraph('/a/entry.ts', host).packages.has('pkg')).toBe(true);
  });

  // `import type` is erased at compile time, so it ships nothing and cannot
  // execute a module-scope side effect. Counting it as an edge makes the
  // content-script guard fail on a module that is provably harmless —
  // src/services/eventReminders/sync.ts imports a PermissionState type from
  // @capacitor/core and is correct to do so.
  it('ignores a type-only import', () => {
    const host = hostFor({ '/a/entry.ts': `import type { T } from 'types-only-pkg';` });
    const g = collectImportGraph('/a/entry.ts', host);

    expect(g.packages.has('types-only-pkg')).toBe(false);
    expect(chainToPackage('/a/entry.ts', 'types-only-pkg', host)).toBeNull();
  });

  it('ignores a type-only re-export', () => {
    const host = hostFor({ '/a/entry.ts': `export type { T } from 'types-only-pkg';` });
    expect(collectImportGraph('/a/entry.ts', host).packages.has('types-only-pkg')).toBe(false);
  });

  it('still counts a value import from a package it also imports types from', () => {
    const host = hostFor({
      '/a/entry.ts': `import type { T } from 'dual';\nimport { thing } from 'dual';`,
    });
    expect(collectImportGraph('/a/entry.ts', host).packages.get('dual')).toEqual(['/a/entry.ts']);
  });
});

describe('chainToPackage', () => {
  it('returns the import chain that reaches a package', () => {
    const host = hostFor({
      '/a/entry.ts': `import './b';`,
      '/a/b.ts': `import './c';`,
      '/a/c.ts': `import s from 'target';`,
    });
    expect(chainToPackage('/a/entry.ts', 'target', host)).toEqual([
      '/a/entry.ts',
      '/a/b.ts',
      '/a/c.ts',
    ]);
  });

  it('returns null when the package is unreachable', () => {
    const host = hostFor({ '/a/entry.ts': `import x from 'other';` });
    expect(chainToPackage('/a/entry.ts', 'target', host)).toBeNull();
  });
});
