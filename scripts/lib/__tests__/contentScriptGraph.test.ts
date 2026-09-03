import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { collectImportGraph, chainToPackage, type GraphHost } from '../importGraph';

const ROOT = resolve(__dirname, '../../..');
const SRC = join(ROOT, 'src');
const CONTENT_ENTRY = join(SRC, 'entrypoints/content.ts');
const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

const host: GraphHost = {
  read(file) {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  },
  resolve(spec, from) {
    let base: string;
    if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null;
    for (const e of EXTS) if (existsSync(base + e)) return base + e;
    for (const e of EXTS) if (existsSync(join(base, `index${e}`))) return join(base, `index${e}`);
    return null;
  },
};

/**
 * Packages that touch `document` while being evaluated. The content script runs
 * at `document_start`, when `document.head` is null and
 * `document.getElementsByTagName('head')[0]` is undefined — so a module-scope
 * `head.appendChild(style)` throws, the whole content script aborts before
 * `main()` registers, and the extension silently never injects.
 *
 * sonner is the known case: its style-inject runs on import. It reached the
 * content script twice — once through the Capacitor recovery prompt (see
 * `src/services/sessionExpiry.ts`, which inverted that dependency) and once
 * through `mobile/demoToast` via `utils/reportError`, which every module calls.
 */
const DOM_ON_IMPORT = ['sonner', 'react-dom', '@fontsource/inter'];

describe('content script import graph', () => {
  const graph = collectImportGraph(CONTENT_ENTRY, host);

  it('reaches the injector from the entry (guard is actually walking)', () => {
    const rel = graph.files.map((f) => f.replace(`${ROOT}/`, ''));
    expect(rel).toContain('src/injector/iframeManager.ts');
    expect(graph.files.length).toBeGreaterThan(50);
  });

  it.each(DOM_ON_IMPORT)('does not statically import %s', (pkg) => {
    const chain = chainToPackage(CONTENT_ENTRY, pkg, host);
    const trail = chain
      ? chain.map((f) => f.replace(`${ROOT}/`, '')).join('\n  -> ') + `\n  -> ${pkg}`
      : '';
    expect(
      chain,
      `'${pkg}' touches the DOM at import time and the content script runs at ` +
        `document_start, before <head> exists — importing it aborts the whole ` +
        `content script and the extension never injects.\n\n  ${trail}\n\n` +
        `Invert the dependency (see src/services/sessionExpiry.ts) instead of ` +
        `importing it from a module the content script can reach.`
    ).toBeNull();
  });
});
