import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "reIS v Claude" is on the EXTENSION tree only, on purpose (Dominik, 2026-11-20).
 *
 * The row points to reIS for Claude (`mcp/`), a Claude Desktop extension for a
 * Mac or Windows laptop. A phone or iPad cannot install it, so a row there
 * would advertise something the student cannot use on that device. The phone
 * tree therefore shows nothing; both halves are pinned so a later "reuse the
 * row" does not bring it to the phone's Novinky.
 *
 * Extension files: components/Notifications/ReisForClaudeRow.tsx,
 * components/Notifications/NotificationDropdown.tsx, components/NotificationFeed.tsx,
 * hooks/useReisForClaude.ts, utils/reisForClaude.ts.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function files(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(join(SRC, rel)).isDirectory()) return files(rel);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

describe('reIS v Claude row placement', () => {
  it("the extension's Novinky and bell have it", () => {
    expect(read('components/Notifications/NotificationDropdown.tsx')).toContain(
      '<ReisForClaudeRow />'
    );
    expect(read('components/NotificationFeed.tsx')).toContain('reisForClaude.badge');
  });

  it.each([...files('components/mobile'), ...files('mobile')])(
    'the phone tree (%s) does not',
    (file) => {
      expect(read(file)).not.toMatch(/ReisForClaude|reisForClaude/);
    }
  );
});
