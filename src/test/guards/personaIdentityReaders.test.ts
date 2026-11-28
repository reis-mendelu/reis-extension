import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Who a reis_admin's persona is, and who it is not (design 2026-11-27 §2).
 *
 * A persona is the whole student: its faculty, programme and Erasmus status sit
 * in the store (`userFaculty`, `userProgramme`, `isErasmus`, guarded by
 * `IDENTITY_OVERLAY_KEYS`), so every reader of the store sees the persona.
 * `getUserParams()` is NOT overlaid: it is the signed-in admin, as IS says.
 * A reader that takes the faculty or programme from it therefore shows the
 * admin while a persona is active, which is right only where the admin is
 * meant. Each such reader is listed here with its reason; a new one fails
 * until someone decides which side it belongs on.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

/** Where the params come from, and the one writer that copies them into the store. */
const SOURCE = ['utils/userParams.ts', 'store/slices/createContextSlice.ts'];

/** Readers that stay the real admin while a persona is active, and why. */
const KEPT_REAL: Record<string, string> = {
  // trackDailyUsage's labels and a report's sender: a count or a bug report
  // must say who sent it, never the persona being viewed (decision 2026-11-27).
  'api/feedback.ts': 'the daily count and a report name their real sender',
  // A library booking is made in the admin's own name at the library.
  'mobile/library/bookingActions.ts': 'a real booking on the admin’s own account',
  // The Learning Agreement prefill: the admin's own document (name, student
  // number, programme), saved to IndexedDB. A persona's programme next to the
  // admin's name would be a wrong document that outlives the persona.
  'components/ErasmusPanel/StudentInfoSection.tsx': 'prefills the admin’s own Learning Agreement',
  'store/slices/createErasmusSlice.ts': 'receives StudentInfoSection’s real params',
};

/**
 * Identity readers that follow the persona: they read the store, not the
 * params. The pattern is the evidence that each still takes it from the store.
 */
const FOLLOW_PERSONA: Record<string, RegExp> = {
  // The Explore tab's "my faculty" filter; it hands the faculty to the drawer.
  'components/ErasmusPanel/index.tsx': /useAppStore\(\(s\) => s\.userFaculty\)/,
  // The faculty's Erasmus coordinator and the filter chip: a prop, which
  // index.tsx fills from the store (checked below).
  'components/ErasmusPanel/ErasmusDrawer.tsx': /faculty: string \| null/,
  // The canteen tabs.
  'utils/menuTabs.ts': /userFaculty/,
  'components/WeeklyCalendar/MenuPopoverContent.tsx': /s\.userFaculty/,
  'components/mobile/sheets/MenuSheet.tsx': /s\.userFaculty/,
  // The faculty IS search scope.
  'components/SearchBar/useSearch.ts': /userFaculty/,
};

/** `x.facultyLabel` / `x?.studyProgram` / `x.isErasmus`, except on a store snapshot `s`. */
const PARAMS_IDENTITY = /\b(?!s\b)\w+\??\.(facultyLabel|studyProgram|isErasmus)\b/;

function sourceFiles(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[]).filter(
    (f) => /\.tsx?$/.test(f) && !/__tests__|\.test\.|\/test\//.test(f) && !f.endsWith('.d.ts')
  );
}

const codeLines = (text: string) => text.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

describe('persona identity readers', () => {
  it('only the listed files read the faculty, programme or Erasmus off the IS params', () => {
    const readers = sourceFiles()
      .filter((f) => codeLines(read(f)).some((l) => PARAMS_IDENTITY.test(l)))
      .sort();
    expect(readers).toEqual([...SOURCE, ...Object.keys(KEPT_REAL)].sort());
  });

  it('ErasmusPanel hands the drawer the store’s faculty', () => {
    expect(read('components/ErasmusPanel/index.tsx')).toMatch(/faculty=\{faculty\}/);
  });

  it.each(Object.keys(KEPT_REAL))('%s still reads the real params', (file) => {
    expect(codeLines(read(file)).some((l) => PARAMS_IDENTITY.test(l))).toBe(true);
  });

  it.each(Object.entries(FOLLOW_PERSONA))(
    '%s reads the store’s identity, not the params',
    (file, from) => {
      const text = read(file);
      expect(text).toMatch(from);
      expect(codeLines(text).some((l) => PARAMS_IDENTITY.test(l))).toBe(false);
    }
  );

  // The persona is already in the store; a second path to it is how a reader
  // ends up half-persona (the state before 2026-11-27).
  it.each(['hooks/useViewer.ts', 'utils/novinky/buildFeed.ts'])(
    '%s has no impersonation special case',
    (file) => {
      expect(codeLines(read(file)).join('\n')).not.toMatch(/impersonat/i);
    }
  );
});
