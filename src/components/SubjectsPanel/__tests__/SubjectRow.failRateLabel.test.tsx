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
 * "28 %" on its own does not say what it is a percentage OF.
 *
 * The label was there all along — but only on hover, behind
 * `max-w-0 opacity-0 … group-hover/fail:max-w-[140px]`. A touch screen has no
 * hover, so on the iPad the word could never appear at all: every subject
 * showed a bare, colour-coded number. Reported as "pridat k neúspěšnosti 28 %
 * 'neúspěšnost' u předmětu ať je to jasné".
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

  it('names the number without needing a hover', () => {
    renderRow(28);
    const label = screen.getByText('subjects.failRateLabel');
    expect(label).toBeInTheDocument();
    // The hover-only mechanism: zero width and zero opacity until hovered.
    expect(label.className).not.toContain('opacity-0');
    expect(label.className).not.toContain('max-w-0');
  });

  it('still shows the number itself', () => {
    renderRow(28);
    expect(screen.getByText(/28\s*%/)).toBeInTheDocument();
  });

  it('says nothing at all when there is no rate to name', () => {
    render(<SubjectRow subject={enrolled} onOpenSubject={() => {}} onSearchSubject={() => {}} />);
    expect(screen.queryByText('subjects.failRateLabel')).not.toBeInTheDocument();
  });
});
