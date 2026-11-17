import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SemesterStats } from '../../../types/documents';
import { SuccessRateView } from '../SuccessRateView';

const sem = (semesterName: string, year: number, garant?: string): SemesterStats => ({
  semesterName: `${semesterName} ${year}/${year + 1} - PEF`,
  semesterId: `${semesterName}${year}`,
  year,
  totalPass: 6,
  totalFail: 4,
  type: 'exam',
  terms: [],
  ...(garant ? { garant } : {}),
});

const view = (semesters: SemesterStats[]) =>
  render(<SuccessRateView semesters={semesters} facultyCode="PEF" showIsBacklink={false} />);

describe('Úspěšnost names the garant of each semester', () => {
  it("shows the selected semester's garant", () => {
    view([
      sem('ZS', 2025, 'doc. Ing. Oldřich Trenz, Ph.D.'),
      sem('ZS', 2024, 'doc. Ing. Oldřich Trenz, Ph.D.'),
    ]);
    expect(screen.getByTestId('garant-line').textContent).toContain(
      'doc. Ing. Oldřich Trenz, Ph.D.'
    );
  });

  it('says nothing about a change when the garant stayed', () => {
    view([sem('ZS', 2025, 'A B'), sem('ZS', 2024, 'A B')]);
    expect(screen.queryByTestId('garant-change')).toBeNull();
    expect(screen.queryByTestId('garant-divider')).toBeNull();
  });

  it('says when the garant changed, and divides the semester chips there', () => {
    view([
      sem('ZS', 2025, 'doc. Ing. Oldřich Trenz, Ph.D.'),
      sem('ZS', 2024, 'doc. Ing. Oldřich Trenz, Ph.D.'),
      sem('ZS', 2023, 'doc. Dr. Ing. Jiří Rybička'),
    ]);
    const note = screen.getByTestId('garant-change').textContent!;
    expect(note).toContain('24/25');
    expect(note).toContain('Jiří Rybička');
    expect(note).toContain('Oldřich Trenz');
    const row = screen
      .getAllByRole('button')
      .map((b) => b.previousElementSibling?.getAttribute('data-testid') ?? null);
    expect(row).toEqual([null, null, 'garant-divider']);
  });

  it('renders no garant UI for data crawled before garants were captured', () => {
    view([sem('ZS', 2025), sem('ZS', 2024)]);
    expect(screen.queryByTestId('garant-line')).toBeNull();
    expect(screen.queryByTestId('garant-change')).toBeNull();
  });
});
