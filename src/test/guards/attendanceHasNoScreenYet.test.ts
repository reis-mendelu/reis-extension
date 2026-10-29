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
 * Any mention counts, comments included: until a placement exists, no screen file
 * on either tree should be about attendance at all.
 *
 * The data keeps syncing: the placement that replaces it will read the same slice.
 * It is parsed out of the subjects page sync already fetches, so it costs no extra
 * request to IS. If the choice is "nowhere", the parser, the attendance slice and
 * its sync plumbing go, and the last test with them.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
// Any spelling a reader could use: the slice, a useAttendance hook, a Czech label.
const MENTIONS_ATTENDANCE = /attendance|docházk|dochazk/i;

function componentFiles(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : componentFiles(path);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [path] : [];
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
    expect(read(file)).not.toMatch(MENTIONS_ATTENDANCE);
  });

  it('no component on either tree reads it', () => {
    const readers = [...componentFiles('components'), ...componentFiles('mobile')]
      .filter((f) => MENTIONS_ATTENDANCE.test(read(f)))
      .map((f) => relative(SRC, join(SRC, f)));
    expect(readers).toEqual([]);
  });

  it('sync still writes it, for the placement that replaces it', () => {
    // The live write: the injector's sync result lands in the store here.
    expect(read('hooks/useAppLogic.ts')).toContain('setAttendance(r.attendance)');
  });
});
