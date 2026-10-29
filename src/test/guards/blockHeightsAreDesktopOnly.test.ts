import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A lesson's height follows its length only on the DESKTOP calendar.
 *
 * "Hodinové přednášky jsou zobrazované jako že mají hodinu a půl": the week
 * grid drew a 14:00-14:50 lesson down to 15:30, because a 90-minute floor sized
 * every block. The fix lives in `WeeklyCalendar/utils.ts` (the grid maths) and
 * `CalendarEventCard.tsx` with `CalendarEventCardOneLine.tsx` (what a block
 * that size can show), and all three are extension-only.
 *
 * The phone and iPad have nothing to fix: their day is a list
 * (`DayAgenda` → `AgendaEvent`), every card is as tall as its text, and the
 * time is written on the card. There is no hour grid for a height to disagree
 * with (`phoneHasNoWeekView.test.ts` pins that the grid is gone). This test
 * fails if a phone file imports the desktop grid or its card; a phone grid
 * should take its heights from `renderedBlockMinutes`, not a copy of it.
 */
const SRC = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

function filesUnder(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(SRC, rel)).isDirectory()) return filesUnder(rel);
    return /\.tsx?$/.test(name) && !rel.includes('__tests__') ? [rel] : [];
  });
}

const PHONE_FILES = [...filesUnder('components/mobile'), ...filesUnder('mobile')];

describe('lesson heights are a desktop concern', () => {
  it('the desktop day column sizes each block from the space organizeLessons gave it', () => {
    // One number for the lanes and the heights: a second copy of the rule is
    // how a block's height and its lane came to disagree before.
    const column = read('components/WeeklyCalendar/WeeklyCalendarDay.tsx');
    expect(column).toContain('organizeLessons(lessons)');
    expect(column).toContain('styleFromMinutes(lesson.startTime, lesson.renderedMinutes)');
  });

  it('the desktop card decides one line or two from that same number', () => {
    const card = read('components/CalendarEventCard.tsx');
    expect(card).toContain('lesson.renderedMinutes >= TWO_LINE_BLOCK_MINUTES');
    expect(card).toContain('<CalendarEventCardOneLine');
  });

  it('the phone day is a list of cards with the time written on them', () => {
    const row = read('components/mobile/screens/calendar/AgendaEvent.tsx');
    expect(row).toContain('lesson.startTime');
    expect(row).toContain('lesson.endTime');
  });

  it.each(PHONE_FILES)('%s draws no time grid of its own', (file) => {
    // Imports only: eventStyles.ts names CalendarEventCard in a comment, for
    // its colours, which is not a grid.
    const imports = read(file)
      .split('\n')
      .filter((line) => /^\s*import\b|\bfrom\s+['"]/.test(line));
    expect(imports.join('\n')).not.toMatch(/WeeklyCalendar\/|CalendarEventCard/);
  });
});
