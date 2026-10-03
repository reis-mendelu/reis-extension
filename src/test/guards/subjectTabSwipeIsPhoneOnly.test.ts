import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Swiping sideways between a subject's tabs (Soubory, Spolužáci, Úspěšnost,
 * Sylabus, Záznamník) exists on the PHONE tree only — which is the iPad too.
 *
 * It answers a touch problem: on a phone the five tabs sit at the top of a
 * full-height sheet, the furthest point from a thumb, and the body is where the
 * thumb already is. The extension's drawer is used with a mouse or trackpad,
 * where the tabs are one pointer move away and a sideways drag already means
 * other things — text selection with a mouse, back/forward with a two-finger
 * trackpad swipe in every desktop browser. A swipe there would fight both and
 * replace nothing. The desktop keeps HeaderTabs, clicked.
 *
 * Both halves are pinned. The trap is `DrawerTabBody`: it is SHARED by the
 * desktop drawer and the phone sheet, so wiring the gesture there instead of
 * in SubjectDrawerScroller would ship it to the extension in one edit.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

function filesUnder(dir: string): string[] {
  const abs = resolve(process.cwd(), 'src', dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    if (statSync(resolve(abs, name)).isDirectory()) return filesUnder(rel);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [rel] : [];
  });
}

const PHONE_FILES = [
  'components/mobile/primitives/useSwipeSteps.ts',
  'components/mobile/primitives/swipeSteps.ts',
  'components/mobile/primitives/swipeStartGuard.ts',
  'components/mobile/sheets/SubjectDrawerScroller.tsx',
  'components/mobile/sheets/SubjectDrawerSheet.tsx',
  'components/mobile/sheets/SubjectDrawerTabs.tsx',
  'components/mobile/sheets/subjectTabStep.ts',
  // Moved, not changed: the calendar's two swipes import the shared hook from
  // primitives now, and behave exactly as before.
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/calendar/DayChips.tsx',
];

describe('subject tab swipe placement', () => {
  it('the phone sheet swipes between tabs', () => {
    const scroller = read('components/mobile/sheets/SubjectDrawerScroller.tsx');
    expect(scroller).toContain('useSwipeSteps');
    expect(scroller).toContain('swipeStartIsOffLimits');
    expect(read('components/mobile/sheets/SubjectDrawerSheet.tsx')).toContain('stepTab');
  });

  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it.each(filesUnder('components/SubjectFileDrawer'))(
    '%s — the desktop drawer and the shared tab body do not swipe',
    (file) => {
      const src = read(file);
      expect(src).not.toContain('useSwipeSteps');
      expect(src).not.toContain('stepTab');
    }
  );
});
