import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Layout (a) for the Subjects screen is a DESKTOP-tree change by nature.
 *
 * The bug ("Bug v předmětech na notebooku…", reIS Task List): on the
 * extension, an open submission box sat beside Studijní průměr with Studijní
 * plán centred under both, three cards of three heights and widths. With a box
 * open, the box now spans the width and the average and the plan split the
 * row under it into equal halves.
 *
 * The phone and iPad never had the problem: SubjectsScreen stacks its cards in
 * one column at every width, with no md:/lg:/grid, so nothing there can sit
 * side by side and come out ragged. Both halves are pinned here, so a later
 * "let's put these side by side on the iPad too" is a decision, not an accident.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('Subjects layout (a) placement', () => {
  it.each(['components/SubjectsPanel/index.tsx'])(
    '%s splits the row under an open box into halves',
    (file) => {
      expect(read(file)).toContain('subjects-bottom-row');
      expect(read(file)).toContain('md:grid-cols-2');
    }
  );

  // Takes its width from the caller, so the desktop row can make it a half.
  it('components/SubjectsPanel/StudyAveragesSection.tsx accepts a className', () => {
    expect(read('components/SubjectsPanel/StudyAveragesSection.tsx')).toContain(
      "className = 'max-w-xl mx-auto'"
    );
  });

  it('components/mobile/screens/SubjectsScreen.tsx stays one column', () => {
    const src = read('components/mobile/screens/SubjectsScreen.tsx');
    expect(src).not.toMatch(/\b(md|lg):/);
    expect(src).not.toMatch(/\bgrid\b/);
  });
});
