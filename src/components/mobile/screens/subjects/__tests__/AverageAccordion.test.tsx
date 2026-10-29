import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AverageAccordion } from '../AverageAccordion';
import { useAppStore } from '../../../../../store/useAppStore';
import type { StudyStats, StudyComparison } from '../../../../../types/studyPlan';

const stats = {
  currentSemester: { gpa: 0 },
  gpaTotal: 2.22,
  weightedGpaTotal: 2.48,
} as unknown as StudyStats;

const comparison: StudyComparison = {
  rank: 362,
  total: 702,
  percentile: 52,
  gpa: 2.22,
  nextBetterGpa: 2.21,
};

// Classes that set a size above the card's own title (`text-md`, 15px). On a
// phone `text-base` is 17px (index.css), so a row set in it outgrew the title
// above it and every neighbouring card ("phone: way too big").
const OVERSIZED = /(^|\s)text-(base|lg|xl|[2-9]xl|\[[^\]]+\])(\s|$)/;

function openCard(cmp: StudyComparison = comparison) {
  const { container } = render(<AverageAccordion studyStats={stats} comparison={cmp} />);
  fireEvent.click(screen.getByRole('button', { name: 'Studijní průměr' }));
  return container;
}

/**
 * The phone Studijní průměr card is set on the same scale as the cards around
 * it: body-size labels, values one step up at most, nothing above the title.
 * The desktop tree has its own, already compact card (StudyAveragesSection).
 */
describe('AverageAccordion type scale', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('keeps the same content and order', () => {
    const container = openCard();
    expect(container.textContent).toMatch(
      /Tento semestr.*–.*Za celé studium.*2,22.*Vážený průměr.*2,48.*Překonáváš 48 % studentů ve svém ročníku\..*Pořadí v ročníku.*362\. \/ 702/
    );
  });

  it('sets labels and the standing sentence at body size, values at most one step up', () => {
    openCard();
    expect(screen.getByText('Studijní průměr')).toHaveClass('text-md');
    for (const label of ['Tento semestr', 'Za celé studium', 'Vážený průměr']) {
      expect(screen.getByText(label)).toHaveClass('text-sm');
    }
    for (const value of ['–', '2,22', '2,48', '362. / 702']) {
      expect(screen.getByText(value)).toHaveClass('text-md');
    }
    expect(screen.getByText('Překonáváš 48 % studentů ve svém ročníku.')).toHaveClass('text-sm');
  });

  it('sets the top-tier sentence at body size too', () => {
    openCard({ ...comparison, rank: 70, percentile: 10 });
    expect(screen.getByText('Jsi v top 10 % ročníku.')).toHaveClass('text-sm');
  });

  it('has no text larger than its own title', () => {
    const container = openCard();
    const els = [...container.querySelectorAll<HTMLElement>('*')];
    const oversized = els
      .map((el) => el.getAttribute('class') ?? '')
      .filter((cls) => OVERSIZED.test(cls));
    expect(oversized).toEqual([]);
    expect(els.filter((el) => el.style.fontSize)).toEqual([]);
  });
});
