import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Who sees something is data, not a list in code (2026-11-27). Showing a thing
 * to some students only (a faculty, a programme) uses the audience tokens
 * (`af`, `pef:B-OI`, `mendelu`) held in Supabase and decided on the device by
 * `matchesAudience` + `useViewer`: `study_aids` for a link under Předměty,
 * `societies.audience` for a partner. Then the admin console retargets or
 * removes it without a store release.
 *
 * A quoted programme code in source (`'B-OI'`, `'pef:B-AII'`) is how a one-off
 * gate starts: it was how "reIS v Claude" shipped, needing a release to widen.
 * Comments may name codes; code may not, outside the files below.
 */
const ALLOWED: Record<string, string> = {
  // The exchange-student programme is a fixed IS code with its own semantics
  // (it hides events), not an audience anyone picks.
  'src/utils/eventAudience.ts': 'Z-EXC',
  // The admin personas (design 2026-11-27, decision #8: a constant in code). Not
  // an audience: nothing is shown to students of these programmes; a reIS admin
  // views reIS AS one. Resolved against IS by code, never stored as an IS id.
  'src/features/personas.ts': 'B-OI, B-F, B-EM, B-METS, B-ZIN, B-SNBD, B-RASZ',
  // Moving to audience tokens in its own PR (reIS v Claude + impersonation).
  'src/utils/reisForClaude.ts': 'B-OI, B-AII, N-OI',
};

const CODE = /['"`](?:[a-z]+:)?[BNPDZ]-[A-Z0-9]{2,10}['"`]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      return name === '__tests__' || name === 'test' || name === 'mock' ? [] : sourceFiles(p);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

/** The line with its comment parts removed: whole comment lines, and a trailing `// …`. */
function codeOf(line: string): string {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
  return line.replace(/\s\/\/.*$/, '');
}

describe('no programme lists in code', () => {
  it('keeps programme codes out of source, outside the allowed files', () => {
    const root = process.cwd();
    const found: string[] = [];
    for (const file of sourceFiles(resolve(root, 'src'))) {
      const rel = relative(root, file);
      if (rel in ALLOWED) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (CODE.test(codeOf(line))) found.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(
      found,
      'A programme code in code is a one-off audience. Put who-sees-it in Supabase ' +
        '(a study_aids row for a link under Předměty, societies.audience for a partner) ' +
        'and decide it with matchesAudience(tokens, useViewer()). See CLAUDE.md "Who sees it is data".'
    ).toEqual([]);
  });

  it('still allows only files that need it', () => {
    // An allow-list entry whose file no longer has a code should be removed.
    const root = process.cwd();
    for (const rel of Object.keys(ALLOWED)) {
      const src = readFileSync(resolve(root, rel), 'utf8');
      expect(
        src.split('\n').some((l) => CODE.test(codeOf(l))),
        `${rel} has no programme code left; drop it from ALLOWED`
      ).toBe(true);
    }
  });
});
