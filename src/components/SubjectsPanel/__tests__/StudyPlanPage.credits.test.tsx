import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, language: 'cs' }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SemesterSection } from '../SemesterSection';
import { HardestUpcomingCard } from '../HardestUpcomingCard';
import type { SubjectStatus, SemesterBlock } from '@/types/studyPlan';

const subject = (over: Partial<SubjectStatus> = {}): SubjectStatus => ({
  id: '1',
  code: 'EBC-MAT',
  name: 'Matematika',
  credits: 6,
  type: 'P',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: 'ZAPSÁNO',
  ...over,
});

const block: SemesterBlock = {
  title: '3. semestr',
  groups: [
    { name: 'Skupina předmětů povinných', statusDescription: '', subjects: [subject()] },
    {
      name: 'Skupina předmětů povinně volitelných',
      statusDescription: '',
      subjects: [subject({ code: 'EBC-STA', name: 'Statistika', credits: 4 })],
    },
  ],
};

const renderSection = () =>
  render(
    <SemesterSection
      block={block}
      open
      dimmed={false}
      onToggle={() => {}}
      onOpenSubject={() => {}}
      onSearchSubject={() => {}}
    />
  );

describe('study plan — credits and group headings', () => {
  /**
   * The semester header used to carry the block's credit total. It counts every
   * subject the plan lists, including the optional ones a student never takes,
   * so it answered a question nobody asked with a number that was not theirs.
   */
  it('does not print a credit total on the semester header', () => {
    renderSection();
    const header = screen.getByRole('button', { name: /3\. semestr/ });
    expect(header.textContent).not.toMatch(/kr\./);
    expect(header.textContent).not.toMatch(/\b10\b/);
  });

  it('prints each subject credits legibly, not as faint filler', () => {
    renderSection();
    const credits = screen.getByText('6 kr.');
    expect(credits.className).toMatch(/font-semibold/);
    expect(credits.className).not.toMatch(/text-base-content\/70/);
  });

  it('makes a group heading read as a heading', () => {
    renderSection();
    const heading = screen.getByText('Povinně volitelné');
    expect(heading.className).toMatch(/font-bold/);
    expect(heading.className).not.toMatch(/text-base-content\/70/);
  });

  /** The hardest-subjects card listed names and fail rates but not credits. */
  it('shows credits in the hardest-subjects card', () => {
    render(
      <HardestUpcomingCard
        entries={[
          {
            subject: subject({ credits: 5, name: 'Ekonometrie' }),
            stat: { rate: 23, n: 120, semesters: 3 },
            semesters: ['3'],
          },
        ]}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    // The card opens on tap; its rows are what carry the credits.
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(screen.getByText('5 kr.')).toBeInTheDocument();
  });
});
