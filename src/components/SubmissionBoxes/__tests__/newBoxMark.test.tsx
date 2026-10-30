import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { SubmissionBoxList } from '../SubmissionBoxList';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * A tap on "Nová odevzdávárna" opens the subject's Záznamník. The new box
 * leads the open ones there, marked, so the subject opens on that box even
 * when an earlier deadline would sort it lower.
 */
describe('SubmissionBoxList — a new box', () => {
  const boxes = [
    box({ name: 'Soon', deadline: '05.10.2026 23:59', odevzdavarnaId: '1' }),
    box({ name: 'Brand new', deadline: '20.12.2026 23:59', odevzdavarnaId: '2' }),
  ];

  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      odevzdavarnyNew: ['2'],
      odevzdavarnySeenNew: [],
    } as never);
  });
  afterEach(cleanup);

  it('comes first among the open boxes, marked Nová', () => {
    render(<SubmissionBoxList boxes={boxes} />);
    const cards = screen.getAllByTestId(/^submission-box-/);
    expect(cards.map((c) => c.dataset.testid)).toEqual(['submission-box-2', 'submission-box-1']);
    expect(within(cards[0]!).getByText('Nová')).toBeInTheDocument();
    expect(within(cards[1]!).queryByText('Nová')).toBeNull();
  });

  // Opening the tab marks it seen at once (markBoxesSeen moves it across);
  // the mark must outlive that, and a remount of the tab too.
  it('stays marked once seen, even when the tab remounts', () => {
    const { unmount } = render(<SubmissionBoxList boxes={boxes} />);
    useAppStore.setState({ odevzdavarnyNew: [], odevzdavarnySeenNew: ['2'] } as never);
    expect(within(screen.getByTestId('submission-box-2')).getByText('Nová')).toBeInTheDocument();
    unmount();
    render(<SubmissionBoxList boxes={boxes} />);
    const cards = screen.getAllByTestId(/^submission-box-/);
    expect(cards.map((c) => c.dataset.testid)).toEqual(['submission-box-2', 'submission-box-1']);
    expect(within(cards[0]!).getByText('Nová')).toBeInTheDocument();
  });

  it('without anything new, soonest first as always', () => {
    useAppStore.setState({ odevzdavarnyNew: [] } as never);
    render(<SubmissionBoxList boxes={boxes} />);
    expect(screen.queryByText('Nová')).toBeNull();
    const cards = screen.getAllByTestId(/^submission-box-/);
    expect(cards.map((c) => c.dataset.testid)).toEqual(['submission-box-1', 'submission-box-2']);
  });
});
