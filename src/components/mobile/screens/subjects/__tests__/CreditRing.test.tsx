import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CreditRing } from '../CreditRing';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * Credits earned over the last two semesters — IS's "Počet získaných kreditů
 * za poslední dvě období". The phone used to print it as "47/40" and paint it
 * orange under 40, but 40 is one faculty's rule and the required count differs
 * across faculties. IS publishes the count and not the minimum, so the phone
 * shows what the desktop panel shows: the bare number, in neutral ink, under a
 * label that says what it counts. The desktop half of this decision is
 * `SubjectsPanelHeader.progression.test.tsx`.
 */
describe('CreditRing — last two semesters', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('shows the count with a label that says what it counts', () => {
    render(<CreditRing earned={147} total={180} lastTwoPeriods={47} />);
    expect(screen.getByText('Kredity za poslední 2 semestry: 47')).toBeInTheDocument();
  });

  it('says the same in English', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<CreditRing earned={147} total={180} lastTwoPeriods={47} />);
    expect(screen.getByText('Credits in the last 2 semesters: 47')).toBeInTheDocument();
  });

  it('quotes no threshold it cannot source', () => {
    render(<CreditRing earned={60} total={180} lastTwoPeriods={32} />);
    expect(screen.queryByText(/\/\s*40\b/)).not.toBeInTheDocument();
  });

  it('passes no verdict: a low count and a high count look the same', () => {
    render(<CreditRing earned={60} total={180} lastTwoPeriods={32} />);
    const low = screen.getByText(/: 32$/).className;
    cleanup();
    render(<CreditRing earned={147} total={180} lastTwoPeriods={47} />);
    const high = screen.getByText(/: 47$/).className;

    expect(low).toBe(high);
    expect(low).not.toMatch(/tone-(success|warning)/);
    // "udělej menším fontem, ať to není tak velký": a secondary line, sized as one.
    expect(low).toContain('text-xs');
  });

  it('says nothing when IS has not reported the figure', () => {
    // 0 is what the parser falls back to when the row is missing, and a
    // first-semester student has no two periods yet.
    render(<CreditRing earned={0} total={180} lastTwoPeriods={0} />);
    expect(screen.queryByText(/2 semestry/)).not.toBeInTheDocument();
    render(<CreditRing earned={0} total={180} lastTwoPeriods={null} />);
    expect(screen.queryByText(/2 semestry/)).not.toBeInTheDocument();
  });
});
