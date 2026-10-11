import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The phone and iPad calendar is DEN ONLY, on purpose (Dominik, 2026-10-11).
 *
 * The week grid (#493) and the Den/Týden choice (#528, #530) were built for the
 * phone tree and removed again within a week: a week block is ~45px wide, so it
 * could carry a name and a room and nothing else, and it never had a route to
 * that room — the Now/Next card's "Trasa" and the row's map pin both live in
 * the day view. Fixing that meant a second control in the grid, or a sheet on
 * every tap, and the answer was that the view itself was the complication. A
 * student who wants the week has the strip's arrows, and the day below it.
 *
 * The extension is the other half and keeps its week: its calendar is always a
 * week (`WeeklyCalendarGrid`), on a screen wide enough for it, and has no day
 * view to choose between. Both halves are pinned so that neither "the phone
 * lost a feature" nor "let's bring the grid back from #493" happens by accident.
 *
 * What stayed from those PRs is Den's: the today mark, the header's way back to
 * today, `useCalendarToday`, portrait-only phones.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');
const exists = (p: string) => existsSync(resolve(process.cwd(), 'src', p));

const REMOVED = [
  'components/mobile/screens/calendar/WeekGrid.tsx',
  'components/mobile/screens/calendar/WeekBlock.tsx',
  'components/mobile/screens/calendar/weekLayout.ts',
  'components/mobile/screens/calendar/useElementHeight.ts',
  'components/mobile/screens/calendar/CalendarViewChooser.tsx',
  'components/mobile/screens/calendar/calendarBottomPad.ts',
  'components/mobile/screens/calendar/WeekMenuButton.tsx',
  'components/mobile/screens/calendar/useCalendarTitle.ts',
  'components/mobile/screens/profile/CalendarViewRow.tsx',
  'components/mobile/sheets/MenuDayTabs.tsx',
  'utils/mobile/formatWeekRange.ts',
];

const KEPT = [
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/screens/calendar/DayChips.tsx',
  'components/mobile/screens/calendar/DayChip.tsx',
  'components/mobile/screens/calendar/DayBody.tsx',
  'components/mobile/screens/calendar/ScreenHeader.tsx',
  'components/mobile/screens/calendar/NowNextCard.tsx',
  'components/mobile/screens/calendar/AgendaEvent.tsx',
  'components/mobile/screens/HeaderActions.tsx',
  'components/mobile/sheets/MenuSheet.tsx',
  'components/mobile/sheets/SettingsSheet.tsx',
  'components/mobile/sheets/SheetHost.tsx',
  'store/slices/createMobileUiSlice.ts',
  'mobile/calendarResume.ts',
];

describe('the phone calendar is Den only', () => {
  it.each(REMOVED)('%s is gone', (file) => {
    expect(exists(file), `${file} came back`).toBe(false);
  });

  it.each(KEPT)('%s still exists', (file) => {
    expect(exists(file)).toBe(true);
  });

  it('the phone calendar renders no week grid and no view chooser', () => {
    const src = read('components/mobile/screens/CalendarScreen.tsx');
    expect(src).not.toContain('WeekGrid');
    expect(src).not.toContain('CalendarViewChooser');
    expect(src).not.toContain('mobileCalendarView');
  });

  it('the day view keeps both routes to a room', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain('<NowNextCard');
    expect(read('components/mobile/screens/calendar/AgendaEvent.tsx')).toContain('showOnMap');
  });

  it('nothing stores a calendar view choice', () => {
    const slice = read('store/slices/createMobileUiSlice.ts');
    expect(slice).not.toContain('CalendarView');
    expect(slice).not.toContain('calendar_view');
    expect(read('components/mobile/sheets/SettingsSheet.tsx')).not.toContain('CalendarViewRow');
  });

  it('the jídelníček sheet takes one day, not a week', () => {
    expect(read('components/mobile/sheets/MenuSheet.tsx')).not.toContain('week');
    expect(read('components/mobile/screens/calendar/DayChips.tsx')).not.toContain("view?: 'day'");
  });

  it('the extension calendar is its own week grid, with a chef hat per day', () => {
    expect(read('components/WeeklyCalendar/index.tsx')).toContain('WeeklyCalendarGrid');
    expect(read('components/WeeklyCalendar/WeeklyCalendarHeader.tsx')).toContain('<ChefHat');
  });
});
