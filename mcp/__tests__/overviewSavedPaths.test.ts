// After mendelu_build_my_map every file is saved, so every row carries textSaved and a
// localPath. The overview must still fit one answer and still show files with their paths:
// a cut list keeps saved rows only up to the cap, never all of them (which would push the
// whole answer into the lean form with no files at all).
import { describe, it, expect } from 'vitest';
import { CHARACTER_LIMIT, toResult } from '../format';
import { renderOverview } from '../overviewRender';
import type { Gathered } from '../overviewGather';
import type { SubjectFile } from '../files';

const subjects = Array.from({ length: 7 }, (_, i) => `EBC-S${i}`);
const file = (code: string, n: number): SubjectFile => ({
  name: `Přednáška ${n} – úvod do problematiky ${code}`,
  file: `prednaska_${n}_${code}_final_verze.pdf`,
  author: 'Novák',
  date: '1. 10. 2026',
  modified: '2. 10. 2026',
  downloadUrl: `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${1000000 + n};id=${123456 + subjects.indexOf(code)};z=1`,
});
const g: Gathered = {
  subjects: subjects.map((code) => ({ code, name: `Předmět ${code}`, subjectId: '1' })),
  listings: Object.fromEntries(
    subjects.map((c) => [c, Array.from({ length: 25 }, (_, n) => file(c, n))])
  ),
  world: { subjects: [], files: {}, points: {} },
  problems: [],
};

describe('the overview after a full build', () => {
  for (const format of ['markdown', 'json'] as const) {
    it(`fits and still lists saved files with their paths (${format})`, () => {
      const out = renderOverview({
        g,
        first: true,
        changes: [],
        profile: null,
        saved: () => true,
        localPath: (f) => `originals/${'a'.repeat(32)}/${f.file}`,
        folder: '/Users/student/Library/Application Support/reIS for Claude',
        format,
      }) as { subjects: { files?: { localPath?: string }[] }[]; savedFiles?: string };
      const text = toResult(out, format).content[0]!.text;
      expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);
      expect(text).not.toContain('[truncated');
      const withPath = out.subjects.flatMap((s) => s.files ?? []).filter((r) => r.localPath);
      expect(withPath.length).toBeGreaterThanOrEqual(subjects.length * 5);
      expect(out.subjects.every((s) => (s.files ?? []).length > 0)).toBe(true);
      expect(out.savedFiles).toContain('reIS for Claude');
    });
  }
});
