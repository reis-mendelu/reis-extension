import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SemesterSelector } from '../SemesterSelector';
import type { SemesterStats } from '../../../types/documents';

const stat = (year: number): SemesterStats => ({
  semesterName: 'ZS',
  semesterId: String(year),
  year,
  totalPass: 8,
  totalFail: 2,
  type: 'exam',
  terms: [],
});

// jsdom has no layout, so this pins the classes that bound the geometry; the
// widths themselves (65px ×5, 80px lone chip) were measured in the phone shell.
describe('SemesterSelector', () => {
  it('caps a phone chip so a lone semester hugs its ring instead of filling the row', () => {
    render(<SemesterSelector stats={[stat(2025)]} activeIndex={0} onSelect={() => {}} />);
    const chip = screen.getByRole('button');
    expect(chip.className).toMatch(/(^|\s)max-w-20(\s|$)/);
    expect(chip.className).toMatch(/(^|\s)sm:max-w-none(\s|$)/);
    expect(chip.parentElement?.className).toMatch(/(^|\s)justify-center-safe(\s|$)/);
  });

  // The row scrolls sideways, so it clips vertically too, and it has no
  // vertical padding: an outer ring lost its top and bottom edges.
  it('draws the active ring inside the chip so the scroll row cannot clip it', () => {
    render(<SemesterSelector stats={[stat(2025)]} activeIndex={0} onSelect={() => {}} />);
    expect(screen.getByRole('button').className).toMatch(/(^|\s)ring-inset(\s|$)/);
  });
});
