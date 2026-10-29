import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The subject header shows no attendance, on either tree.
 *
 * The desktop drawer header drew the last ten attendance records as coloured
 * dots with a bare "0/1" in monospace beside them. Nobody could tell what it
 * counted, so it was removed (Task List, 2026-10-29). The phone and iPad subject
 * sheet never had it, so there is nothing to remove there — this pins that half
 * too, because the new place for attendance is still Dominik's choice and should
 * arrive on both trees at once, labelled, not as this component reused.
 *
 * The data keeps syncing: the placement that replaces it will read the same slice.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('subject header attendance', () => {
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

  it('still syncs attendance for the placement that replaces it', () => {
    expect(read('store/slices/createSubjectsSlice.ts')).toContain('setAttendance');
  });
});
