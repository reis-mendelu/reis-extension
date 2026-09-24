import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CreditRing } from '../CreditRing';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * Credits earned over the last two semesters, against the 40 a student needs to
 * stay enrolled. Of everything on this screen it is the number with the
 * sharpest consequence — fall short and the student can be excluded — and the
 * phone did not show it at all. The desktop panel shows the count ("Posl. 2
 * semestry: 47"); this adds what it is measured against.
 */
describe('CreditRing — last two semesters', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('shows the credits of the last two semesters against the minimum', () => {
    render(<CreditRing earned={147} total={180} lastTwoPeriods={47} />);
    expect(screen.getByText('Posl. 2 semestry: 47/40')).toBeInTheDocument();
  });

  it('is set smaller than the credit total it qualifies', () => {
    // "udělej menším fontem, ať to není tak velký": a secondary line, sized as one.
    render(<CreditRing earned={147} total={180} lastTwoPeriods={47} />);
    expect(screen.getByText('Posl. 2 semestry: 47/40').className).toContain('text-xs');
  });

  it('reads as fine at or above the minimum', () => {
    render(<CreditRing earned={147} total={180} lastTwoPeriods={40} />);
    // The tone token, not bare `text-success`: #22c55e-ish on white is under
    // AA at text-xs. The tone is the same hue darkened in light, unchanged in dark.
    expect(screen.getByText('Posl. 2 semestry: 40/40').className).toContain(
      'text-[var(--tone-success)]'
    );
  });

  it('warns below the minimum', () => {
    render(<CreditRing earned={60} total={180} lastTwoPeriods={32} />);
    // Bare `text-warning` (#f59e0b) measured 2.15:1 on the light card.
    // The warning tone is darker in light and slightly lighter in dark.
    expect(screen.getByText('Posl. 2 semestry: 32/40').className).toContain(
      'text-[var(--tone-warning)]'
    );
  });

  it('says nothing when IS has not reported the figure', () => {
    // 0 is what the parser falls back to when the row is missing, and a
    // first-semester student has no two periods yet — neither is a warning.
    render(<CreditRing earned={0} total={180} lastTwoPeriods={0} />);
    expect(screen.queryByText(/Posl\. 2 semestry/)).not.toBeInTheDocument();
    render(<CreditRing earned={0} total={180} lastTwoPeriods={null} />);
    expect(screen.queryByText(/Posl\. 2 semestry/)).not.toBeInTheDocument();
  });
});
