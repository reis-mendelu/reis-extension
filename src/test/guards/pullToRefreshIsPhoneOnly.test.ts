import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pull-to-refresh, and the nudge that teaches it, exist on the PHONE tree only.
 *
 * It is a touch gesture on a scrolling list. The extension is used with a mouse
 * or trackpad in a desktop browser, where dragging a list down does nothing and
 * a list that slides by itself teaches a gesture nobody can make. So the desktop
 * keeps a visible control instead: ExamsFreshness, the circle beside
 * "aktualizováno před …", which calls the same exams-only
 * `triggerExamsRefresh`. The desktop calendar has no manual refresh at all —
 * that is a known gap, not a choice made here.
 *
 * A subject's Files tab pulls too (SubjectDrawerScroller). Its desktop twin is
 * FilesFreshness, the refresh circle in the drawer header, and both call the
 * same `refreshFilesForSubject` — so what a refresh keeps and adds is one rule
 * (`mergeFolderListing`) on both products, and only the trigger differs.
 *
 * Both halves are pinned. The phone files below own the gesture; the desktop
 * surfaces must not reach for them (a "just reuse the indicator" would ship a
 * gesture with no touch behind it) and the desktop exams panel keeps its button.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/primitives/PullRefreshIndicator.tsx',
  'components/mobile/primitives/RefreshButton.tsx',
  'components/mobile/primitives/pullHint.ts',
  'components/mobile/primitives/pullToRefresh.ts',
  'components/mobile/primitives/usePullHint.ts',
  'components/mobile/primitives/usePullToRefresh.ts',
  'components/mobile/primitives/useRefreshHold.ts',
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/screens/ExamsScreen.tsx',
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/exams/ExamsPullArea.tsx',
  'components/mobile/sheets/SubjectDrawerScroller.tsx',
  'components/mobile/sheets/SubjectDrawerSheet.tsx',
];

function filesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), 'src', dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(resolve(abs, name)).isDirectory()) return filesUnder(rel);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [rel] : [];
  });
}

const DESKTOP_SURFACES = [
  ...filesUnder('components/WeeklyCalendar'),
  ...filesUnder('components/ExamPanel'),
  ...filesUnder('components/Exams'),
  ...filesUnder('components/SubjectFileDrawer'),
  'components/CalendarEventCard.tsx',
];

describe('pull-to-refresh placement', () => {
  it.each(PHONE_FILES)('%s exists on the phone tree', (file) => {
    expect(read(file).length).toBeGreaterThan(0);
  });

  it('the phone calendar and exams screens are the ones that pull', () => {
    expect(read('components/mobile/screens/calendar/DayBody.tsx')).toContain(
      'PullRefreshIndicator'
    );
    expect(read('components/mobile/screens/exams/ExamsPullArea.tsx')).toContain(
      'PullRefreshIndicator'
    );
    expect(read('components/mobile/sheets/SubjectDrawerScroller.tsx')).toContain(
      'PullRefreshIndicator'
    );
  });

  it.each(DESKTOP_SURFACES)('%s does not use the touch-only pull', (file) => {
    const src = read(file);
    expect(src).not.toContain('PullRefreshIndicator');
    expect(src).not.toContain('usePullToRefresh');
    expect(src).not.toContain('usePullHint');
    expect(src).not.toContain('useRefreshHold');
  });

  it('the desktop exams panel keeps its visible refresh button', () => {
    expect(read('components/ExamPanel/ExamsFreshness.tsx')).toContain('triggerExamsRefresh');
  });

  it('the desktop subject drawer keeps its files refresh button, on the same action', () => {
    expect(read('components/SubjectFileDrawer/Header/FilesFreshness.tsx')).toContain(
      'refreshFilesForSubject'
    );
    expect(read('components/mobile/sheets/SubjectDrawerScroller.tsx')).toContain(
      'refreshFilesForSubject'
    );
  });
});
