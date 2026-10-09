import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Where is today" is answered on BOTH trees — the extension simply had it
 * first. The October 2026 phone change brought the phone up to it; the parts
 * of that change with no desktop twin are phone-only by construction.
 *
 * - The today mark: the desktop week header tints today's column and colours
 *   its date (`bg-current-day-header`, `text-current-day`). The phone's chip
 *   now carries a filled circle and `aria-current="date"`.
 * - Today always in its week: the phone's `weekDays(…, todayIso)` and the
 *   desktop's `visibleDayCount` (which reads `todayIndex`) both add a
 *   lesson-free weekend day when it is today.
 * - Week steps land on today in today's week, the selection is ink rather
 *   than a lime pill, and the week view draws no selection and no dots
 *   (`stepWeek`, DayChip, DayChips `view`, October 2026): phone only, because
 *   only the phone has a selected day and a dot row. The extension grid steps a whole
 *   week with nothing selected, and marks today's column wherever it is —
 *   `useCalendarData.test.ts` pins that the report did not reproduce there.
 * - Back to today on resume (`installCalendarResumeReset`): Capacitor only. The
 *   extension's iframe is rebuilt on every IS page load, so it opens fresh —
 *   the same reason `eventsResumeRefreshIsCapacitorOnly` gives.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const PHONE_FILES = [
  'src/components/mobile/screens/calendar/DayChips.tsx',
  'src/components/mobile/screens/calendar/DayChip.tsx',
  'src/components/mobile/screens/calendar/DayBody.tsx',
  'src/components/mobile/screens/calendar/WeekGrid.tsx',
  'src/utils/mobile/weekDays.ts',
  'src/mobile/calendarResume.ts',
];

describe('today is marked on both trees', () => {
  it.each(PHONE_FILES)('%s exists', (file) => {
    expect(() => read(file)).not.toThrow();
  });

  it('the phone strip marks today apart from the selection', () => {
    expect(read('src/components/mobile/screens/calendar/DayChip.tsx')).toContain(
      "aria-current={isToday ? 'date' : undefined}"
    );
  });

  it('the extension grid widens to a weekend today', () => {
    expect(read('src/components/WeeklyCalendar/useCalendarData.ts')).toContain('todayIndex === 5');
  });

  // Across midnight, too: both trees take today from the store's clock, which
  // the pulse advances, so a calendar left open overnight moves with it.
  it('both trees read today from the store clock, not a frozen new Date()', () => {
    expect(read('src/components/mobile/screens/calendar/DayChips.tsx')).toContain('s.now');
    expect(read('src/components/WeeklyCalendar/useCalendarData.ts')).toContain('state.now');
  });

  it('the extension week header marks today', () => {
    const header = read('src/components/WeeklyCalendar/WeeklyCalendarHeader.tsx');
    expect(header).toContain('bg-current-day-header');
    expect(header).toContain('text-current-day');
  });

  it('the Capacitor boot installs the reset before the demo return', () => {
    const src = read('capacitor/startApp.ts');
    const install = src.indexOf('installCalendarResumeReset();');
    expect(install, 'startApp no longer installs the calendar reset').toBeGreaterThan(-1);
    expect(install).toBeLessThan(src.indexOf('if (demo) return;'));
  });
});
