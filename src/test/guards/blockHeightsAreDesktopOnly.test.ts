import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A lesson's height follows its length, and there is ONE rule for it.
 *
 * "Hodinové přednášky jsou zobrazované jako že mají hodinu a půl": the week
 * grid drew a 14:00-14:50 lesson down to 15:30, because a 90-minute floor sized
 * every block. The fix lives in `WeeklyCalendar/utils.ts` (the grid maths) and
 * `CalendarEventCard.tsx` with `CalendarEventCardOneLine.tsx` (what a block
 * that size can show).
 *
 * The phone's day is a list (`DayAgenda` → `AgendaEvent`), every card as tall
 * as its text with the time written on it. The phone's week grid (back since
 * spec 2026-10-30) takes its lanes AND heights from that same maths —
 * `weekLayout.placeDay` reads `organizeLessons(...).renderedMinutes` — so a
 * phone file may import `WeeklyCalendar/utils` and nothing else of the desktop
 * grid: not its components, not its card, and never a copy of the rule.
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

  it.each(PHONE_FILES)('%s borrows no desktop grid component or card', (file) => {
    // Imports only: eventStyles.ts names CalendarEventCard in a comment, for
    // its colours, which is not a grid.
    const imports = read(file)
      .split('\n')
      .filter((line) => /^\s*import\b|\bfrom\s+['"]/.test(line));
    expect(imports.join('\n')).not.toMatch(/WeeklyCalendar\/(?!utils['"])|CalendarEventCard/);
  });

  it('the phone week grid sizes blocks from the same renderedMinutes', () => {
    const layout = read('components/mobile/screens/calendar/weekLayout.ts');
    expect(layout).toContain("from '../../../WeeklyCalendar/utils'");
    expect(layout).toContain('l.renderedMinutes');
  });
});
