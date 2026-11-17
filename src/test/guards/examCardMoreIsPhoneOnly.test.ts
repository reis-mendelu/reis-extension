import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One "Více" per exam card is a PHONE-tree change only (Task List: "Více
 * still appears on unregistered exams. Unite with registered terms").
 *
 * The phone's Zkoušky cards had a "Více" on every term row, each opening the
 * same form, length and teacher's note; they now have one per card, showing
 * only what every term shares (utils/mobile/sectionFacts), and the rows say
 * their own "Přihlášení do" inline.
 *
 * The desktop ExamPanel never had a per-term "Více" to unite: its tiles show
 * the length, the note and "Kdo jde se mnou" in place (TermExtras,
 * TermNoteBlock). So
 * there is nothing to port, and a later "reuse the phone's card details on
 * desktop" would reintroduce a control the desktop layout does not need.
 * Both halves are pinned here.
 */
const root = resolve(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function filesUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : filesUnder(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('exam card "Více" lives on the phone only', () => {
  it.each(filesUnder('components/ExamPanel'))(
    '%s takes nothing from the phone exam cards',
    (file) => {
      const source = read(file);
      expect(source).not.toContain('mobile/screens/exams');
      expect(source).not.toContain('sectionFacts');
      expect(source).not.toContain('useExamNotes');
    }
  );

  it.each([
    'components/mobile/screens/exams/OpenCard.tsx',
    'components/mobile/screens/exams/NotYetOpenCard.tsx',
  ])('%s has one card-level Více and rows that open nothing', (file) => {
    const source = read(file);
    expect(source).toContain('<SectionMore');
    expect(source).toContain('showDetails={false}');
  });

  // The rest of the phone-only pieces of this change, named so the parity
  // check knows they are deliberate.
  it.each([
    'components/mobile/screens/exams/SectionMore.tsx',
    'components/mobile/screens/exams/SectionDetails.tsx',
    'components/mobile/screens/exams/DetailParts.tsx',
    'components/mobile/screens/exams/TermDetails.tsx',
    'components/mobile/screens/exams/TermRow.tsx',
    'components/mobile/screens/exams/MoreChip.tsx',
    'hooks/data/useExamNotes.ts',
    'utils/mobile/sectionFacts.ts',
  ])('%s exists on the phone tree', (file) => {
    expect(read(file).length).toBeGreaterThan(0);
  });
});
