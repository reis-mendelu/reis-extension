// reIS for Claude (mcp/) is a public product that handles a student's IS
// password. These are its standing promises; a change here is a product
// decision, not a refactor. Decided with Dominik 2026-10-10; the reasoning is in
// docs/superpowers/specs/2026-10-10-student-mcp-design.md.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '../../../mcp');
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ f, src: readFileSync(join(dir, f), 'utf8') }));

describe('reIS for Claude stays read-only and local', () => {
  it('scans the real host directory', () => {
    expect(sources.map((s) => s.f)).toEqual(expect.arrayContaining(['login.ts', 'tools.ts']));
  });

  it('never reaches online tests or a generic page fetch', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/psani_testu|elis\/ot/);
      expect(src, f).not.toMatch(/mendelu_raw|mendelu_table/);
    }
  });

  it('never talks to Supabase or any reIS server', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/supabase|featureUsage|suggestions/i);
    }
  });

  it('never writes credentials or the cookie to disk', () => {
    for (const { f, src } of sources) {
      expect(src, f).not.toMatch(/writeFile|appendFile|createWriteStream/);
    }
  });

  it('only POSTs to the IS login form', () => {
    const posts = sources.filter(({ src }) => /method:\s*'POST'/.test(src)).map(({ f }) => f);
    expect(posts).toEqual(['login.ts']);
  });
});
