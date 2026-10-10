import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The calendar view chooser and the Nastavení sheet are PHONE/iPAD ONLY, on
 * purpose (spec 2026-10-09).
 *
 * The extension's calendar is always the week (`weekViewHasBothTrees`), so
 * there is no view to choose, and its Profile popover already shows language
 * and dark mode inline with room to spare. The phone moved those behind one
 * row because a phone screen must fit without scrolling. A later "let's reuse
 * the sheet on desktop" would add a choice the desktop cannot act on.
 *
 * Both halves are pinned: the phone files exist and are wired; the desktop
 * neither imports them nor grows a view choice.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/screens/calendar/CalendarViewChooser.tsx',
  'components/mobile/screens/calendar/calendarBottomPad.ts',
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/calendar/WeekGrid.tsx',
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/screens/ProfileScreen.tsx',
  'components/mobile/screens/profile/CalendarViewRow.tsx',
  'components/mobile/screens/profile/AppearanceRows.tsx',
  'components/mobile/sheets/SettingsSheet.tsx',
  'components/mobile/sheets/SheetHost.tsx',
  'components/mobile/nav/BottomNav.tsx',
  'mobile/calendarResume.ts',
];

describe('calendar view choice is phone-only', () => {
  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone calendar mounts the chooser', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<CalendarViewChooser');
  });

  it('the phone Profile opens the settings sheet', () => {
    expect(read('components/mobile/screens/ProfileScreen.tsx')).toContain("kind: 'settings'");
  });

  it.each(['components/WeeklyCalendar/index.tsx', 'components/Sidebar/ProfilePopup.tsx'])(
    '%s has no calendar view choice',
    (file) => {
      const src = read(file);
      expect(src).not.toContain('CalendarViewChooser');
      expect(src).not.toContain('saveCalendarView');
      expect(src).not.toContain('SettingsSheet');
    }
  );
});
