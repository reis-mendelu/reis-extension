import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isTrustedHostOrigin } from '../../utils/trustedOrigin';

/**
 * The ISIC balance and top-up are on the PHONE/iPad tree only, by decision.
 *
 * What "only" means, precisely: the extension's iframe app imports App.tsx,
 * which imports the whole phone tree (it forks on isPhone at runtime), so this
 * code is IN the extension bundle like every phone feature — and cannot run
 * there: the store does nothing off Capacitor, and the extension has no host
 * permission for webiskam. reIS for Claude is stricter: it handles the
 * student's password, so its server graph must not reach this code at all.
 *
 * WebISKAM was removed from reIS in #247 (2026-08-30) because that integration
 * was not implemented well enough and its scope was far too large. It came back
 * on 2026-10-13 deliberately narrow (Dominik): the Hlavní konto balance and a
 * card / Google Pay top-up on the mobile menza sheet — nothing in the
 * extension, no dorm, reservation or meal-order pages. The extension still
 * rejects the webiskam origin, and nothing outside the phone tree may import
 * the WebISKAM code. Spec: docs/superpowers/specs/2026-10-13-isic-balance-topup-design.md
 */
const MOBILE_ONLY = [
  'src/mobile/iskam/iskamJar.ts',
  'src/mobile/iskam/iskamCookieStore.ts',
  'src/mobile/iskam/iskamHttp.ts',
  'src/mobile/iskam/samlForm.ts',
  'src/mobile/iskam/kontaParser.ts',
  'src/mobile/iskam/topUp.ts',
  'src/mobile/iskam/iskamSession.ts',
  'src/mobile/iskam/iskamLogin.ts',
  'src/mobile/iskam/iskamStore.ts',
  'src/mobile/iskam/clearIskam.ts',
  'src/mobile/iskam/iskamTopUp.ts',
  'src/components/mobile/sheets/IskamBalanceRow.tsx',
  'src/components/mobile/sheets/IskamTopUpForm.tsx',
  'src/components/mobile/sheets/MenuSheet.tsx',
  'src/components/mobile/screens/calendar/MenuCard.tsx',
];

/** Files outside src/mobile/iskam that may reach it, each on the phone tree. */
const ALLOWED_IMPORTERS = new Set([
  'src/components/mobile/sheets/IskamBalanceRow.tsx',
  'src/components/mobile/sheets/IskamTopUpForm.tsx',
  'src/components/mobile/sheets/MenuSheet.tsx',
  'src/components/mobile/screens/calendar/MenuCard.tsx',
]);

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'test') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(relative(root, p));
    }
  }
  return out;
}

/** Import closure from an entry, the way mcpStaysReadOnly computes it (dynamic imports included). */
function importClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const resolveImport = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = join(root, 'src', spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(c) && /\.tsx?$/.test(c)) return c;
    }
    return null;
  };
  const visit = (file: string) => {
    const r = relative(root, file);
    if (seen.has(r)) return;
    seen.add(r);
    for (const m of readFileSync(file, 'utf8').matchAll(
      /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
    )) {
      const next = resolveImport(file, m[1]!);
      if (next) visit(next);
    }
  };
  visit(entry);
  return seen;
}

describe('WebISKAM stays on the phone tree', () => {
  it.each(MOBILE_ONLY)('%s exists (a rename must update this guard)', (f) => {
    expect(existsSync(join(root, f))).toBe(true);
  });

  it('nothing else imports the WebISKAM code or names its host', () => {
    // Imports (static and dynamic) and the host name — not prose: comments
    // such as IndexedDBService's note on deleting the old `iskam` store are fine.
    const REACHES = /(from\s+|import\(\s*)['"][^'"]*\/iskam\/[^'"]*['"]|webiskam\.mendelu\.cz/i;
    const offenders = walk(join(root, 'src'))
      .filter((f) => !f.startsWith('src/mobile/iskam/') && !ALLOWED_IMPORTERS.has(f))
      .filter((f) => REACHES.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('reIS for Claude cannot reach the WebISKAM code, through any import chain', () => {
    const reached = [...importClosure(join(root, 'mcp/server.ts'))].filter((f) =>
      f.startsWith('src/mobile/iskam/')
    );
    expect(reached).toEqual([]);
  });

  it('the extension asks for no webiskam host permission', () => {
    expect(readFileSync(join(root, 'wxt.config.ts'), 'utf8')).not.toMatch(/webiskam/i);
  });

  // Sign-out reaches the WebISKAM login through this registration, not an
  // import: src/mobile/signOut.ts is in the shared graph (proxyClient imports
  // it), and an import there put this code inside reIS for Claude.
  it('the Capacitor entry registers the WebISKAM sign-out cleanup', () => {
    const entry = readFileSync(join(root, 'capacitor/main.capacitor.tsx'), 'utf8');
    expect(entry).toMatch(/registerSignOutCleanup\(/);
    expect(entry).toContain('@/mobile/iskam/clearIskam');
  });

  it('the extension still rejects the webiskam origin (#247)', () => {
    expect(isTrustedHostOrigin('https://webiskam.mendelu.cz', false)).toBe(false);
  });
});
