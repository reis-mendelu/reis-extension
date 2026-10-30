import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The week view is on BOTH trees — the extension simply had it first.
 *
 * The phone/iPad calendar was a day agenda only; the October 2026 week grid
 * (`WeekGrid`) brought it the week the desktop has shown since it shipped
 * (`WeeklyCalendar`). They are two implementations on purpose: the desktop grid
 * is a fixed 7–21 that scrolls and is used with hover, while a phone screen must
 * fit without scrolling (`#root` clips), so the phone fits the hours to the week
 * and cascades a clash instead of halving a 45px column. Lane assignment is
 * shared — `weekLayout.ts` calls the desktop's own `organizeLessons`.
 *
 * Same for the way back to today: the phone made the header date the control
 * (and tapping the Kalendář tab again), because its header is full; the
 * extension keeps its "Dnes" button in AppHeader. Each tree has one.
 *
 * And the room (spec 2026-10-30). The phone removed Týden once (#540) because
 * its blocks gave no way to the room. Both trees now answer it the same way:
 * the block shows the room, a tap opens the subject, and the subject opened
 * from a block names that lesson's room with a way to the map — the
 * extension's drawer through `CourseMeta`'s room button, the phone's sheet
 * through `WeekLessonPlace` (only from Týden: Den's row already has a pin).
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/screens/calendar/WeekBody.tsx',
  'components/mobile/screens/calendar/WeekGrid.tsx',
  'components/mobile/screens/calendar/WeekNowStrip.tsx',
  'components/mobile/screens/calendar/CalendarViewSwitch.tsx',
  'components/mobile/screens/calendar/useOpenWeekLesson.ts',
  'components/mobile/sheets/WeekLessonPlace.tsx',
  'components/mobile/screens/calendar/WeekBlock.tsx',
  'components/mobile/screens/calendar/weekLayout.ts',
  'components/mobile/screens/calendar/useCalendarToday.ts',
  'components/mobile/screens/calendar/useElementHeight.ts',
  'components/mobile/screens/calendar/useOpenLesson.ts',
  'components/mobile/screens/calendar/eventStyles.ts',
  'components/mobile/screens/calendar/ScreenHeader.tsx',
  'components/mobile/screens/calendar/DayChips.tsx',
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/calendar/AgendaEvent.tsx',
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/nav/BottomNav.tsx',
];

/**
 * Decided phone-only parts of Týden's return (spec 2026-10-30), named so the
 * tree-parity hook does not ask about them again:
 *
 * - the PINCH between Den and Týden (`usePinchView.ts`, and `useSwipeSteps.ts`
 *   standing down on a second finger). The extension is used with a mouse and
 *   has no two-finger gesture to map it to; its week is always on screen.
 * - the floating Den/Týden switch and the band that clears it
 *   (`CalendarViewSwitch.tsx`, `calendarBottomPad.ts`): the extension has one
 *   view, the week, and nothing to switch.
 * - the phone's own week layout and chrome, which the extension draws its own
 *   way (`WeeklyCalendar/`): `WeekBody.tsx`, `WeekGrid.tsx`, `WeekBlock.tsx`,
 *   `weekLayout.ts`, `WeekNowStrip.tsx`, `useOpenWeekLesson.ts`,
 *   `useCalendarTitle.ts`, `useElementHeight.ts`, `DayChip.tsx`,
 *   `DayChips.tsx`, `DayBody.tsx`, `ScreenHeader.tsx`, `HeaderActions.tsx`,
 *   `WeekMenuButton.tsx`, `MenuSheet.tsx`, `MenuDayTabs.tsx`, `SheetHost.tsx`,
 *   `SubjectDrawerSheet.tsx`, `WeekLessonPlace.tsx`, `CalendarScreen.tsx`,
 *   `calendarResume.ts`, `formatWeekRange.ts`, `weekDays.ts`. The capability
 *   each serves is on both trees; the tests below pin that.
 * - Týden's Halloween week marks (`weekHalloween.ts`, `WeekHalloweenMarks.tsx`,
 *   and Den's `HalloweenDayEnd.tsx`): the extension decorates its own week
 *   grid its own way — bats in the top bar, a cobweb in the hours' corner
 *   (`HalloweenHeaderBats`, `WeeklyCalendarHeader`), from the same art.
 */
const PHONE_ONLY_BY_DESIGN = [
  'components/mobile/screens/calendar/usePinchView.ts',
  'components/mobile/primitives/useSwipeSteps.ts',
  'components/mobile/screens/calendar/CalendarViewSwitch.tsx',
  'components/mobile/screens/calendar/calendarBottomPad.ts',
  'components/mobile/screens/calendar/weekHalloween.ts',
  'components/mobile/screens/calendar/WeekHalloweenMarks.tsx',
  'components/mobile/screens/calendar/HalloweenDayEnd.tsx',
];

describe('week view on both trees', () => {
  it.each(PHONE_ONLY_BY_DESIGN)('%s exists (phone-only by design)', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  // Every file of the desktop calendar, not one (PR #618 review).
  it.each(
    readdirSync(resolve(process.cwd(), 'src/components/WeeklyCalendar')).filter((f) =>
      /\.tsx?$/.test(f)
    )
  )('the extension calendar has no pinch: WeeklyCalendar/%s', (file) => {
    expect(read(`components/WeeklyCalendar/${file}`)).not.toMatch(/touches|pinch|gesturestart/i);
  });

  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone renders the week grid', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<WeekBody');
    expect(read('components/mobile/screens/calendar/WeekBody.tsx')).toContain('<WeekGrid');
  });

  it('the phone switches on the calendar itself, not in Nastavení', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<CalendarViewSwitch');
    expect(read('components/mobile/sheets/SettingsSheet.tsx')).not.toContain('CalendarView');
  });

  it('a block shows its room on both trees', () => {
    expect(read('components/mobile/screens/calendar/WeekBlock.tsx')).toContain('<MapPin');
    expect(read('components/CalendarEventCard.tsx')).toContain('<MapPin');
  });

  it("the subject opened from a block names that lesson's room on both trees", () => {
    expect(read('components/SubjectFileDrawer/Header/CourseMeta.tsx')).toContain(
      'focusRoomByCode(lesson.room)'
    );
    expect(read('components/mobile/screens/calendar/useOpenWeekLesson.ts')).toContain(
      'weekLesson: lesson'
    );
    expect(read('components/mobile/sheets/SubjectDrawerSheet.tsx')).toContain('<WeekLessonPlace');
  });

  it("Den's tap carries no lesson: its row already has the pin", () => {
    expect(read('components/mobile/screens/calendar/useOpenLesson.ts')).not.toContain('weekLesson');
  });

  it('the phone shares the desktop lane maths', () => {
    expect(read('components/mobile/screens/calendar/weekLayout.ts')).toContain('organizeLessons');
  });

  it('the extension has its own week grid', () => {
    expect(read('components/WeeklyCalendar/index.tsx')).toContain('WeeklyCalendarGrid');
  });

  it('the extension keeps its own way back to today', () => {
    expect(read('components/AppHeader.tsx')).toContain("t('common.today')");
  });
});
