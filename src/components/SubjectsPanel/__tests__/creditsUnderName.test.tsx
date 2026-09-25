import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string) => (k === 'subjects.creditsShort' ? 'kr.' : k),
    language: 'cs',
  }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import { HardestUpcomingCard } from '../HardestUpcomingCard';
import type { SubjectStatus } from '@/types/studyPlan';

const subject = (over: Partial<SubjectStatus> = {}): SubjectStatus => ({
  id: '1',
  code: 'EBC-EKO',
  name: 'Ekonometrie',
  credits: 5,
  type: 'P',
  isEnrolled: false,
  isFulfilled: false,
  enrollmentCount: 0,
  rawStatusText: '',
  ...over,
});

const tokens = (el: HTMLElement) => el.className.split(/\s+/);

/**
 * The study plan and the hardest-subjects card above it put the same number in
 * two different places: under the name on one, beside the fail-rate chip on the
 * other, and from `md:` up the plan moved it to a column after the chip. One
 * position, at every width, in both.
 */
function expectUnderName(name: string) {
  const credits = screen.getAllByText('5 kr.');
  expect(credits).toHaveLength(1);
  const cell = credits[0]!;
  expect(tokens(cell).some((c) => c === 'hidden' || c.endsWith(':hidden'))).toBe(false);
  // Its sibling is the name: same column, the line below it.
  expect(cell.parentElement?.firstElementChild?.textContent).toBe(name);
  expect(cell.previousElementSibling?.textContent).toBe(name);
}

describe('credits sit under the subject name', () => {
  it('in a study-plan row', () => {
    render(<SubjectRow subject={subject()} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expectUnderName('Ekonometrie');
  });

  it('in a compact study-plan row', () => {
    render(
      <SubjectRow subject={subject()} compact onOpenSubject={() => {}} onSearchSubject={() => {}} />
    );
    expectUnderName('Ekonometrie');
  });

  const renderCard = (s: SubjectStatus) => {
    render(
      <HardestUpcomingCard
        entries={[{ subject: s, stat: { rate: 23, n: 120, semesters: 3 }, semesters: ['3'] }]}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );
    fireEvent.click(screen.getAllByRole('button')[0]!);
  };

  it('in the hardest-subjects card, styled like the plan row', () => {
    renderCard(subject());
    expectUnderName('Ekonometrie');
    render(<SubjectRow subject={subject()} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    const [card, row] = screen.getAllByText('5 kr.');
    expect(card!.className).toBe(row!.className);
  });

  /** IS prints 999 for "credits unknown"; the plan hides it, so must the card. */
  it('hides the 999 sentinel in the hardest-subjects card', () => {
    renderCard(subject({ credits: 999 }));
    expect(screen.queryByText(/999/)).toBeNull();
  });
});
