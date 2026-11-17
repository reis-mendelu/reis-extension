import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Hiding a lesson exists on both trees since 2026-11-06 (suggestion #43), but
 * the PHONE deliberately offers one choice fewer.
 *
 * The extension's hover menu has three: this lesson, every seminar (lecture)
 * of the subject, and the whole subject. The phone's hold menu
 * (HideLessonSheet) has the first two only. A hold is easy to make by accident
 * on a touch screen, so the menu it opens should not carry the biggest hide;
 * a student who wants the whole subject gone hides its seminars and its
 * lectures. Decided with Dominik for #43, whose case — "I don't attend the
 * seminars" — is the second choice.
 *
 * Both halves are pinned, so a later "let's reuse the extension's menu" (or
 * its `hideAll`) on the phone is a decision, not an accident.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('whole-subject hide placement', () => {
  it('components/mobile/sheets/HideLessonSheet.tsx offers no whole-subject hide', () => {
    const sheet = read('components/mobile/sheets/HideLessonSheet.tsx');
    expect(sheet).not.toContain('hideAll');
    expect(sheet).not.toContain('calendar.hide.allLessons');
  });

  it('components/CalendarEventCardHideMenu.tsx still does', () => {
    const menu = read('components/CalendarEventCardHideMenu.tsx');
    expect(menu).toContain('hideAll');
    expect(menu).toContain('calendar.hide.allLessons');
  });
});
