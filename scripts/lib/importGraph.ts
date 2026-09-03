/**
 * Static import-graph walker, used to keep the content script honest.
 *
 * WXT bundles a content script as ONE file, so a dynamic `import()` inside it
 * is inlined rather than split. That makes every static edge out of
 * `entrypoints/content.ts` a real cost, and — for any package that touches the
 * DOM while it is being evaluated — a real hazard: the content script runs at
 * `document_start`, when `<head>` and `<body>` do not exist yet.
 *
 * `services/sessionExpiry.ts` documents the first time this bit (sonner pulled
 * in through the Capacitor recovery prompt, 416 kB -> 966 kB). This module
 * exists so the second time is caught by a test instead of by a student.
 *
 * Deliberately static-only: `import()` edges are NOT followed. A lazy edge is
 * still inlined by WXT, but it cannot execute module-scope side effects at
 * `document_start`, which is the failure this guards.
 */

export interface ImportGraph {
  /** Absolute paths of every first-party module reachable from the entry. */
  files: string[];
  /** Bare specifier -> the first-party files that import it. */
  packages: Map<string, string[]>;
}

export interface GraphHost {
  /** Reads a module's source, or returns null when it cannot be read. */
  read(file: string): string | null;
  /**
   * Resolves a specifier to an absolute first-party path, or null when the
   * specifier is a bare package (or otherwise not first-party).
   */
  resolve(specifier: string, fromFile: string): string | null;
}

/**
 * Matches `import ... from '<spec>'` and `export ... from '<spec>'`.
 *
 * `(?!type\s)` excludes `import type` / `export type`, which TypeScript erases
 * at compile time: they ship no code and cannot run a module-scope side effect,
 * so counting them as edges fails the content-script guard on a module that is
 * provably harmless. `src/services/eventReminders/sync.ts` is the live example —
 * it takes a `PermissionState` type from `@capacitor/core` and is right to.
 *
 * A per-specifier `import { type A, b }` is deliberately still an edge: `b` is a
 * value, so the module is emitted and its side effects run.
 */
const FROM_RE = /(?:^|[\n;])\s*(?:import|export)\s+(?!type\s)[^;\n]*?from\s*['"]([^'"]+)['"]/g;
/** Matches a side-effect-only `import '<spec>'`. */
const BARE_IMPORT_RE = /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g;

function specifiersIn(source: string): string[] {
  const out: string[] = [];
  for (const re of [FROM_RE, BARE_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * Walks static imports breadth-first from `entry`, collecting first-party
 * files and the bare packages they pull in.
 */
export function collectImportGraph(entry: string, host: GraphHost): ImportGraph {
  const visited = new Set<string>();
  const packages = new Map<string, string[]>();
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    const source = host.read(file);
    if (source === null) continue;

    for (const spec of specifiersIn(source)) {
      const resolved = host.resolve(spec, file);
      if (resolved === null) {
        const importers = packages.get(spec);
        if (importers) importers.push(file);
        else packages.set(spec, [file]);
      } else if (!visited.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return { files: [...visited], packages };
}

/**
 * Shortest static import chain from `entry` to the first file importing
 * `packageName`, or null when the package is not reachable. Used to make a
 * failure message name the edge to cut rather than just the package.
 */
export function chainToPackage(
  entry: string,
  packageName: string,
  host: GraphHost
): string[] | null {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const file = queue.shift();
    if (file === undefined) continue;

    const source = host.read(file);
    if (source === null) continue;

    for (const spec of specifiersIn(source)) {
      if (spec === packageName || spec.startsWith(`${packageName}/`)) {
        const chain: string[] = [];
        for (let c: string | null | undefined = file; c; c = parent.get(c)) chain.push(c);
        return chain.reverse();
      }
      const resolved = host.resolve(spec, file);
      if (resolved !== null && !parent.has(resolved)) {
        parent.set(resolved, file);
        queue.push(resolved);
      }
    }
  }

  return null;
}
