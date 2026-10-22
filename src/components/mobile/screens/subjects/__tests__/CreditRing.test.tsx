import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CreditRing } from '../CreditRing';
import { useAppStore } from '../../../../../store/useAppStore';

/**
 * The ring used to print "Kredity za poslední 2 semestry: N" under the credit
 * line. IS publishes that count with no minimum (the minimum differs by
 * faculty), so it told a student nothing and was removed from the card on both
 * trees. The desktop half is `SubjectsPanel.noCreditsLastTwo.test.tsx`.
 */
describe('CreditRing', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('shows the earned / required credits and the percentage', () => {
    render(<CreditRing earned={147} total={180} />);
    expect(screen.getByText('82 %')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Splněno 82 % kreditů' })).toBeInTheDocument();
  });

  it('does not show the last-two-semesters line, in either language', () => {
    render(<CreditRing earned={147} total={180} />);
    expect(screen.queryByText(/2 semestry/)).not.toBeInTheDocument();
    cleanup();
    useAppStore.setState({ language: 'en' } as never);
    render(<CreditRing earned={147} total={180} />);
    expect(screen.queryByText(/last 2 semesters/)).not.toBeInTheDocument();
  });
});
