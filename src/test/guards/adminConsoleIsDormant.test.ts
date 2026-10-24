import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The admin console is parked: no build gives a way into it (Dominik and
 * Tonda, Signal 2026-10-22, "admin = supabase"). Societies never post
 * themselves, events are imported through Claude, and everything the console
 * shows lives in Supabase, which Claude reads and writes directly. Without a
 * door, the team uses that path instead of the console.
 *
 * The console itself stays in the tree, and `openSocietyAdmin` stays in the
 * store, so the dev harness (`npm run dev:web:admin`, then
 * `__reisStore.getState().openSocietyAdmin()`) can still open it. What goes is
 * every door a student build had: holding your name in Profil (both trees), the
 * "Spravovat spolky" row (both trees), and the extension's toast announcing new
 * suggestions to a reIS admin, which pointed at a console nobody can open.
 *
 * To bring it back: put the long-press and the row back in ProfileIdentity,
 * ProfileScreen and ProfilePopup, mount SuggestionsToast in AppOverlays, and
 * change this guard to match.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf-8');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') sources(p, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

// The console's own files and the store may name the action; nothing else may.
const ALLOWED = ['src/components/AdminConsole/', 'src/store/'];

describe('the admin console is dormant', () => {
  it('no screen outside the console opens it', () => {
    const callers = sources(join(root, 'src'))
      .map((p) => relative(root, p))
      .filter((p) => !ALLOWED.some((a) => p.startsWith(a)))
      .filter((p) => /openSocietyAdmin/.test(read(p)));
    expect(callers).toEqual([]);
  });

  it('has no door in Profil on either tree', () => {
    for (const p of [
      'src/components/mobile/screens/ProfileScreen.tsx',
      'src/components/mobile/screens/profile/ProfileIdentity.tsx',
      'src/components/Sidebar/ProfilePopup.tsx',
    ]) {
      expect(read(p)).not.toMatch(/admin\.entry|useLongPress/);
    }
  });

  it('does not announce suggestions for a console nobody can open', () => {
    expect(read('src/components/AppOverlays.tsx')).not.toMatch(/<SuggestionsToast\b/);
  });

  it('keeps the console itself in the tree', () => {
    expect(read('src/App.tsx')).toMatch(/<AdminConsole\b/);
  });
});
