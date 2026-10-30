import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The jídelníček is reachable from the WEEK view on both trees, by a chef hat —
 * placed differently on each, on purpose (2026-10-10).
 *
 * The extension's week has a hat on every day column that serves
 * (`WeeklyCalendarHeader`). The phone's week grid has no room for that: a row
 * of per-day icons under the date strip was mocked and cost the grid ~35px,
 * truncating lesson names that fit. So the phone has ONE hat in the header,
 * week view only — Den shows the menu card instead.
 *
 * Both halves are pinned so neither quietly loses its way to the menu.
 *
 * The rest rides with it, phone-only, and none of it has a desktop half:
 * Týden selects no day — its chips are labels, its title is the week's range
 * (`useCalendarTitle`, `formatWeekRange`), and the hat's sheet carries the
 * week as day tabs (`MenuSheet`, `MenuDayTabs`). The extension's week has no
 * phone header to title and no day selection to remove.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

const PHONE_FILES = [
  'components/mobile/screens/calendar/WeekMenuButton.tsx',
  'components/mobile/screens/calendar/ScreenHeader.tsx',
  'components/mobile/screens/HeaderActions.tsx',
  'components/mobile/screens/CalendarScreen.tsx',
  'components/mobile/screens/calendar/DayChips.tsx',
  'components/mobile/screens/calendar/DayChip.tsx',
  'components/mobile/screens/calendar/useCalendarTitle.ts',
  'utils/mobile/formatWeekRange.ts',
  'components/mobile/sheets/MenuSheet.tsx',
  'components/mobile/sheets/MenuDayTabs.tsx',
  'components/mobile/sheets/SheetHost.tsx',
];

describe('the week view reaches the menu on both trees', () => {
  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone calendar puts the chef hat in its header', () => {
    expect(read('components/mobile/screens/CalendarScreen.tsx')).toContain(
      'leadingAction={<WeekMenuButton'
    );
    expect(read('components/mobile/screens/calendar/WeekMenuButton.tsx')).toContain('<ChefHat');
  });

  it('the extension week keeps a chef hat per day', () => {
    expect(read('components/WeeklyCalendar/WeeklyCalendarHeader.tsx')).toContain('<ChefHat');
  });
});
