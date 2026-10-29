import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Attendance lives in one place: the Docházka section at the top of the
 * Záznamník tab, on both trees.
 *
 * The desktop drawer header used to draw the last ten records as coloured dots
 * with a bare "0/1" beside them. Nobody could tell what it counted (Task List,
 * 2026-10-29), so it moved into Záznamník with a summary in words and every
 * session listed (mockup B, chosen by Dominik). The phone and iPad sheet never
 * had the dots; it gets the section through the same shared tab body.
 *
 * Any mention counts, comments included, so a second attendance display — in a
 * header, a hook, or under a Czech label — has to come through here on purpose.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');
const MENTIONS_ATTENDANCE = /attendance|docházk|dochazk/i;

function componentFiles(dir: string): string[] {
  return readdirSync(join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : componentFiles(path);
    return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [path] : [];
  });
}

describe('attendance lives in Záznamník', () => {
  it.each([
    // desktop: the drawer header and the line under its meta
    'components/SubjectsPanel/ZaznamnikLine.tsx',
    'components/SubjectFileDrawer/DrawerHeader.tsx',
    // phone + iPad: the subject sheet and its header
    'components/mobile/sheets/SubjectSheetHeader.tsx',
    'components/mobile/sheets/SubjectDrawerSheet.tsx',
  ])('%s shows no attendance', (file) => {
    expect(read(file)).not.toMatch(MENTIONS_ATTENDANCE);
  });

  it('only the Záznamník tab and its Docházka section read it, the root App included', () => {
    const readers = ['App.tsx', ...componentFiles('components'), ...componentFiles('mobile')]
      .filter((f) => MENTIONS_ATTENDANCE.test(read(f)))
      .map((f) => relative(SRC, join(SRC, f)))
      .sort();
    expect(readers).toEqual([
      'components/SubjectFileDrawer/Zaznamnik/AttendanceSection.tsx',
      'components/SubjectFileDrawer/ZaznamnikTab.tsx',
    ]);
  });

  it('reaches both trees through the shared tab body', () => {
    expect(read('components/SubjectFileDrawer/DrawerTabBody.tsx')).toContain('<ZaznamnikTab');
    // desktop drawer
    expect(read('components/SubjectFileDrawer/SubjectFileDrawerContent.tsx')).toContain(
      "from './DrawerTabBody'"
    );
    // phone + iPad sheet
    expect(read('components/mobile/sheets/SubjectDrawerSheet.tsx')).toContain(
      "from '../../SubjectFileDrawer/DrawerTabBody'"
    );
  });

  it('sync still writes it', () => {
    // The live write: the injector's sync result lands in the store here.
    expect(read('hooks/useAppLogic.ts')).toContain('setAttendance(r.attendance)');
  });
});
