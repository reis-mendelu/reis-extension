import { readFileSync } from 'node:fs';
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
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/screens/calendar/WeekGrid.tsx',
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

describe('week view on both trees', () => {
  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone renders the week grid', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<WeekGrid');
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
