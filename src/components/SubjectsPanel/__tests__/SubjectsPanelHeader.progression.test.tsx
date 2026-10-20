import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
    language: 'cz',
  }),
}));
vi.mock('@/hooks/useUserParams', () => ({ useUserParams: () => ({ params: { studium: '1' } }) }));

import { SubjectsPanelHeader } from '../SubjectsPanelHeader';

/**
 * reIS used to judge progression against 12 credits in a first semester and 40
 * over the last two, hardcoded. That is PEF's rule: "kámoš ze zahradnické
 * fakulty má minimum 15 kreditů, lidi z PEF mají minimum 12". IS's
 * pruchod_studiem.pl publishes the counts and not the minimum, so there is no
 * honest per-faculty source — and a verdict of "v pořádku" delivered to a
 * student who is in fact one credit short is worse than no verdict.
 *
 * The COUNTS stay, because they come from IS. The threshold, the deficit and
 * the safe/warning/danger sentence go.
 */
describe('the progression verdict', () => {
  const renderHeader = () =>
    render(
      <SubjectsPanelHeader
        creditsAcquired={6}
        creditsRequired={180}
        plan={null}
        enrolledCredits={20}
      />
    );

  it('passes no verdict on a student six credits into a first semester', () => {
    renderHeader();
    expect(screen.queryByText(/progressionSafe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/progressionWarning/)).not.toBeInTheDocument();
    expect(screen.queryByText(/progressionDanger/)).not.toBeInTheDocument();
    expect(screen.queryByText(/needMore/)).not.toBeInTheDocument();
    expect(screen.queryByText(/notEnoughEnrolled/)).not.toBeInTheDocument();
  });

  it('quotes no threshold it cannot source', () => {
    renderHeader();
    expect(screen.queryByText(/\/\s*12\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/\s*40\b/)).not.toBeInTheDocument();
  });

  it('still reports what is enrolled right now', () => {
    renderHeader();
    expect(screen.getByText(/subjects\.enrolledCreditsLabel/)).toBeInTheDocument();
  });
});
