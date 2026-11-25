// reIS for Claude (mcp/) is a public product that handles a student's IS
// password. These are its standing promises; a change here is a product
// decision, not a refactor. Decided with Dominik 2026-10-10; the reasoning is in
// docs/superpowers/specs/2026-10-10-student-mcp-design.md.
//
// The disk promise changed on 2026-11-25 by Dominik's decision: the server may
// keep a map of what it read in one per-laptop folder, through mcp/store.ts and
// nowhere else, and that store never holds the password or the IS sign-in. See
// docs/superpowers/specs/2026-11-25-reis-for-claude-map-design.md. Until that map
// is wired in (step 2 of 7) nothing the server runs imports the store, so at
// runtime nothing is written to disk yet.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const mcpDir = join(root, 'mcp');
const sources = readdirSync(mcpDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ f, src: readFileSync(join(mcpDir, f), 'utf8') }));

/** Every source file the MCP server can run: its import closure from mcp/server.ts. */
function importClosure(entry: string): Map<string, string> {
  const seen = new Map<string, string>();
  const resolveImport = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = join(root, 'src', spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null; // a package, not reIS code
    for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(c) && c.match(/\.tsx?$/)) return c;
    }
    return null;
  };
  const visit = (file: string) => {
    if (seen.has(file)) return;
    const src = readFileSync(file, 'utf8');
    seen.set(file, src);
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1]!);
      if (next) visit(next);
    }
  };
  visit(entry);
  return seen;
}

/** The store's files: the only ones that may write, and they never touch credentials. */
const STORE_FILES = sources.filter(({ f }) => /^store.*\.ts$/.test(f));
/** The only store files that write bytes: the store itself and its atomic-write helper. */
const MAY_WRITE = ['store.ts', 'storeFs.ts'];

const closure = importClosure(join(mcpDir, 'server.ts'));
const rel = (file: string) => relative(root, file).split('\\').join('/');

/**
 * The POSTs the server may make, each with its reason. Anything else that
 * POSTs (a submission, a registration, a setting) must never become reachable.
 */
const ALLOWED_POSTS: Record<string, string> = {
  'mcp/login.ts': 'the IS login form, the only place the password goes',
  'src/api/schedule.ts': 'the read-only timetable query (rozvrhy_view.pl), same as the app',
};

describe('reIS for Claude stays read-only and local', () => {
  it('scans the real server graph', () => {
    const files = [...closure.keys()].map(rel);
    expect(files).toEqual(
      expect.arrayContaining(['mcp/login.ts', 'mcp/tools.ts', 'src/api/schedule.ts'])
    );
  });

  it('never reaches online tests or a generic page fetch', () => {
    for (const [file, src] of closure) {
      expect(src, rel(file)).not.toMatch(/psani_testu|elis\/ot\//);
    }
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/mendelu_raw|mendelu_table/);
    }
  });

  // mcp/ itself never names Supabase. The wider source graph does reach
  // src/services/admin/authClient.ts (api/client -> proxyClient ->
  // clearAdminSession), but nothing on the server path calls it and the bundler
  // drops it; scripts/mcp-pack.mjs fails if a Supabase host is in the bundle.
  it('never talks to Supabase or any reIS server', () => {
    for (const { f: file, src } of sources) {
      expect(src, file).not.toMatch(/supabase|featureUsage|api\/suggestions/i);
    }
  });

  it('writes to disk only through the store, and the store never sees credentials', () => {
    expect(STORE_FILES.map((s) => s.f)).toEqual(expect.arrayContaining(MAY_WRITE));
    for (const { f, src } of sources) {
      if (MAY_WRITE.includes(f)) continue;
      expect(src, f).not.toMatch(/\b(writeFile|appendFile|createWriteStream|rename)\b/);
    }
    for (const { f, src } of STORE_FILES) {
      expect(src, f).not.toMatch(/login|session|UISAuth|cookie|MENDELU_PASS/i);
    }
  });

  // Step 1 of the map: the store exists but nothing calls it, so the product
  // still writes nothing. Step 2 removes this test when it wires the store in.
  it('does not run the store yet', () => {
    for (const file of closure.keys()) {
      expect(rel(file), 'the server must not reach the store yet').not.toMatch(/mcp\/store/);
    }
  });

  it('POSTs only where the allow-list says, anywhere in the server graph', () => {
    const posts = [...closure]
      .filter(([, src]) => /method:\s*['"`]POST['"`]/i.test(src))
      .map(([file]) => rel(file))
      .sort();
    expect(posts).toEqual(Object.keys(ALLOWED_POSTS).sort());
  });

  it('sends the password to the exact IS login endpoint and nowhere else', () => {
    const login = sources.find((s) => s.f === 'login.ts')?.src ?? '';
    expect(login).toContain("const LOGIN_URL = 'https://is.mendelu.cz/system/login.pl';");
    expect(login).toMatch(/fetchImpl\(LOGIN_URL,/);
    // No other URL in the file the credentials could be posted to.
    expect(login.match(/https?:\/\/[^'"`\s]+/g)).toEqual(['https://is.mendelu.cz/system/login.pl']);
  });

  // Decided with Dominik 2026-11-20: a .mcpb from GitHub never updates itself.
  // The one non-IS request mcp/ makes on its own: an anonymous GET, no student data.
  it('asks GitHub only for the latest release, anonymously, and the plugin never asks', () => {
    const check = sources.find((s) => s.f === 'updateCheck.ts')?.src ?? '';
    expect(check.match(/https?:\/\/[^'"`\s]+/g)).toEqual([
      'https://api.github.com/repos/reis-mendelu/reis-for-claude/releases/latest',
      'https://reisapp.cz/navody/reis-v-claude',
    ]);
    expect(check).toContain("method: 'GET'");
    expect(check).toContain("credentials: 'omit'");
    expect(check).not.toMatch(/MENDELU_USER|MENDELU_PASS|sessionFetch/);
    const plugin = readFileSync(join(root, 'vite.mcp.plugin.config.ts'), 'utf8');
    expect(plugin).toContain("replacement: resolve(__dirname, 'mcp/updateCheckOff.ts')");
  });
});
