import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
    language: 'cs',
  }),
}));
vi.mock('@/hooks/ui/useCourseName', () => ({ useCourseName: (_c: string, n: string) => n }));
vi.mock('@/hooks/useTimeline', () => ({ useTimeline: () => null }));
vi.mock('@/hooks/data/useSpeculativeHover', () => ({
  useSpeculativeHover: () => ({ onMouseEnter: () => {}, onMouseLeave: () => {} }),
}));

import { SubjectRow } from '../SubjectRow';
import { useAppStore } from '@/store/useAppStore';
import type { SubjectStatus } from '@/types/studyPlan';

const enrolled: SubjectStatus = {
  id: '123456',
  code: 'EBC-PSI',
  name: 'Počítačové sítě',
  credits: 6,
  type: 'P',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: 'ZAPSÁNO',
};

/**
 * "28 %" on its own does not say what it is a percentage OF — and it must say
 * so somewhere a thumb can reach.
 *
 * First the label was hover-only (`max-w-0 opacity-0` until :hover), which on a
 * touch screen means never. Then it was spelled out on every row, which at
 * 320px was most of the row: "Prům neúspěšnost zabírá strašně prostoru, čím to
 * nahradit?". Now the row keeps the number and `FailRateLegend` names it once
 * per list. These tests pin the row's half of that: a bare number, plus a
 * title/aria-label for a mouse and a screen reader — never a hover-only label
 * as the ONLY explanation.
 */
describe('SubjectRow fail-rate label', () => {
  beforeEach(() => {
    useAppStore.setState({ gradeHistory: null, successRates: {} } as never);
  });

  const renderRow = (failRate: number) =>
    render(
      <SubjectRow
        subject={enrolled}
        failRate={failRate}
        onOpenSubject={() => {}}
        onSearchSubject={() => {}}
      />
    );

  it('shows the number and not the spelled-out label', () => {
    renderRow(28);
    expect(screen.getByText(/28\s*%/)).toBeInTheDocument();
    // The words moved to the legend; repeating them on every row is what made
    // the column too wide to live with.
    expect(screen.queryByText('subjects.failRateLabel')).not.toBeInTheDocument();
  });

  it('still names the number for a mouse and a screen reader', () => {
    renderRow(28);
    const pill = screen.getByLabelText(/subjects\.failRateLabel 28 %/);
    expect(pill).toBeInTheDocument();
    // Not the hover-only mechanism this replaced: the pill is visible at rest.
    expect(pill.className).not.toContain('opacity-0');
    expect(pill.className).not.toContain('max-w-0');
  });

  it('says nothing at all when there is no rate to name', () => {
    render(<SubjectRow subject={enrolled} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});
