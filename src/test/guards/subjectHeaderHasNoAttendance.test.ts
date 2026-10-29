import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No screen shows attendance, on either tree, until it gets a labelled place.
 *
 * The desktop drawer header drew the last ten attendance records as coloured
 * dots with a bare "0/1" in monospace beside them. Nobody could tell what it
 * counted, so it was removed (Task List, 2026-10-29). The phone and iPad subject
 * sheet never had it, so there is nothing to remove there — this pins that half
 * too, because the new place for attendance is still Dominik's choice and should
 * arrive on both trees at once, labelled, not as this component reused. Building
 * that placement means rewriting this guard on purpose.
 *
 * The data keeps syncing: the placement that replaces it will read the same slice.
 * If the choice is "nowhere", drop the sync and the last test with it.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function componentFiles(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : componentFiles(path);
    return e.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('attendance has no screen yet', () => {
  it.each([
    // desktop: the line under the drawer header's meta
    'components/SubjectsPanel/ZaznamnikLine.tsx',
    'components/SubjectFileDrawer/DrawerHeader.tsx',
    // phone + iPad: the subject sheet and its header
    'components/mobile/sheets/SubjectSheetHeader.tsx',
    'components/mobile/sheets/SubjectDrawerSheet.tsx',
  ])('%s does not read attendance', (file) => {
    expect(read(file)).not.toMatch(/attendance/i);
  });

  it('no component on either tree reads it', () => {
    const readers = [...componentFiles('components'), ...componentFiles('mobile')]
      .filter((f) => /\battendance\b/i.test(read(f)))
      .map((f) => relative(SRC, join(SRC, f)));
    expect(readers).toEqual([]);
  });

  it('sync still writes it, for the placement that replaces it', () => {
    expect(read('services/sync/syncSubjects.ts')).toContain('setAttendance(');
  });
});
