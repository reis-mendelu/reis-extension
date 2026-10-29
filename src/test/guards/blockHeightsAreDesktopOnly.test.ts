import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A lesson's height follows its length only on the DESKTOP calendar.
 *
 * "Hodinové přednášky jsou zobrazované jako že mají hodinu a půl": the week
 * grid drew a 14:00-14:50 lesson down to 15:30, because a 90-minute floor sized
 * every block. The fix lives in `WeeklyCalendar/utils.ts` (the grid maths) and
 * `CalendarEventCard.tsx` (what a block that size can show), and both are
 * extension-only.
 *
 * The phone and iPad have nothing to fix: their day is a list
 * (`DayAgenda` → `AgendaEvent`), every card is as tall as its text, and the
 * time is written on the card. There is no hour grid for a height to disagree
 * with (`phoneHasNoWeekView.test.ts` is why). If the phone ever draws lessons on
 * a time grid again, it must take its heights from `renderedBlockMinutes`, not a
 * copy of it — this test is what fails first.
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
  it('the desktop grid sizes blocks from renderedBlockMinutes', () => {
    expect(read('components/WeeklyCalendar/utils.ts')).toContain(
      'export function renderedBlockMinutes'
    );
    expect(read('components/CalendarEventCard.tsx')).toContain('renderedMinutes');
  });

  it('the phone day is a list of cards with the time written on them', () => {
    const row = read('components/mobile/screens/calendar/AgendaEvent.tsx');
    expect(row).toContain('lesson.startTime');
    expect(row).toContain('lesson.endTime');
    expect(read('components/mobile/screens/calendar/DayAgenda.tsx')).not.toMatch(/style=\{/);
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
