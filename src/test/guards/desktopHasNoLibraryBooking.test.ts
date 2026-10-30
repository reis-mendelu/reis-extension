import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Library study-room booking is on the PHONE/iPad tree only, by decision
 * (Dominik, 2026-10-30).
 *
 * Why not the extension: the booking call goes from the device straight to the
 * library's Microsoft Bookings. The extension's iframe is a foreign web origin,
 * which Bookings refuses (CORS), and a content-script proxy would need a new
 * host permission and a new store review for a feature the desktop does not
 * have a use for. And reIS for Claude, which handles a password, must not reach
 * a code path that books or cancels anything for the student.
 *
 * What "only" means: the extension bundle still contains this code (the iframe
 * app imports the phone tree), but `canBookLibrary()` is false off Capacitor and
 * the extension has no permission for the host. The extension's map does show
 * the six rooms (the polygons are shared), just with nothing to book.
 *
 * It was removed once before (#275, 2026-09-03) as outside reIS's competence and
 * came back narrow: no reIS server, no stored hash, no Supabase table.
 */
const MOBILE_ONLY = [
  'src/mobile/library/bookingsBase.ts',
  'src/mobile/library/availability.ts',
  'src/mobile/library/createBooking.ts',
  'src/mobile/library/cancelBooking.ts',
  'src/mobile/library/transport.ts',
];

/** Files outside src/mobile/library that may reach it, each on the phone tree. */
const ALLOWED_IMPORTERS = new Set<string>([]);

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'test') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(relative(root, p).split(sep).join('/'));
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
    const r = relative(root, file).split(sep).join('/');
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

describe('library booking stays on the phone tree', () => {
  it.each(MOBILE_ONLY)('%s exists (a rename must update this guard)', (f) => {
    expect(existsSync(join(root, f))).toBe(true);
  });

  it('nothing else imports the booking code or names its host', () => {
    const REACHES =
      /(from\s+|import\s*\(\s*|import\s+)['"][^'"]*\/api\/library\/[^'"]*['"]|bookings\.cloud\.microsoft/i;
    expect(REACHES.test("import { x } from '../mobile/library/createBooking';")).toBe(true);
    const offenders = walk(join(root, 'src'))
      .filter((f) => !f.startsWith('src/mobile/library/') && !ALLOWED_IMPORTERS.has(f))
      .filter((f) => REACHES.test(readFileSync(join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('reIS for Claude cannot reach the booking code, through any import chain', () => {
    const reached = [...importClosure(join(root, 'mcp/server.ts'))].filter((f) =>
      f.startsWith('src/mobile/library/')
    );
    expect(reached).toEqual([]);
  });

  it('the extension asks for no Bookings host permission', () => {
    expect(readFileSync(join(root, 'wxt.config.ts'), 'utf8')).not.toMatch(/bookings\.cloud/i);
  });
});
