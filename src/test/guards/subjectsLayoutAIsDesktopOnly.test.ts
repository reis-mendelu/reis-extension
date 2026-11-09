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
 * row under it into equal halves (components/SubjectsPanel/index.tsx, with
 * components/SubjectsPanel/StudyAveragesSection.tsx taking its width from the
 * caller).
 *
 * The phone and iPad never had the problem: SubjectsScreen stacks its cards in
 * one flex column at every width, so nothing there can sit side by side and
 * come out ragged. Both halves are pinned here, so a later "let's put these
 * side by side on the iPad too" is a decision, not an accident.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('Subjects layout (a) placement', () => {
  // The desktop half is pinned by rendering, not by substrings: the layout
  // test mounts SubjectsPanel with and without an open box and checks which
  // cards land in the halves row. This only makes sure that test stays.
  it('the desktop row is covered by a rendered test of both states', () => {
    const test = read('components/SubjectsPanel/__tests__/SubjectsPanel.layout.test.tsx');
    expect(test).toContain("getByTestId('subjects-bottom-row')");
    expect(test).toContain("queryByTestId('subjects-bottom-row')).toBeNull()");
  });

  it('components/mobile/screens/SubjectsScreen.tsx stacks its cards in one flex column', () => {
    const screen = read('components/mobile/screens/SubjectsScreen.tsx');
    // The cards are AlwaysScrollable's children, and it is a flex column.
    expect(screen).toContain('<AlwaysScrollable');
    expect(read('components/mobile/primitives/AlwaysScrollable.tsx')).toMatch(/\bflex-col\b/);
    // Every way Tailwind could put two of them side by side, or change that per width.
    expect(screen).not.toMatch(/\b(grid|flex-row|columns-\w+|inline-flex)\b/);
    expect(screen).not.toMatch(/\b(sm|md|lg|xl|2xl):/);
  });
});
