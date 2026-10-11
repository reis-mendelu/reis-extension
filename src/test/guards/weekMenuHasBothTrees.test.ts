import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The jídelníček is reachable from the calendar on both trees, by different
 * means, on purpose.
 *
 * The extension's week has a chef hat on every day column that serves
 * (`WeeklyCalendarHeader`). The phone's calendar is Den only
 * (`phoneHasNoWeekView.test`), and Den carries the menu as a card under the
 * day's lessons (`MenuCard`), which opens the day's `MenuSheet`. A header hat
 * for the week, with day tabs in the sheet, existed for two days (#530) and
 * went with the week grid.
 *
 * Both halves are pinned so neither quietly loses its way to the menu.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('the calendar reaches the menu on both trees', () => {
  it('the phone Den view shows the menu card', () => {
    expect(read('components/mobile/screens/calendar/DayBody.tsx')).toContain('<MenuCard');
  });

  it('the extension week keeps a chef hat per day', () => {
    expect(read('components/WeeklyCalendar/WeeklyCalendarHeader.tsx')).toContain('<ChefHat');
  });
});
