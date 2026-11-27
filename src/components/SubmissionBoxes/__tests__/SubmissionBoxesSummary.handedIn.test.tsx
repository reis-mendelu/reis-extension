import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * Task List: "Odevzdávárny: odevzdaný otevřený box se ukazuje dvakrát".
 * A box can be handed in and still open (the teacher leaves it open). It is
 * already listed under "Odevzdáno (N)", so the expanded list of open boxes
 * must not list it a second time.
 */
describe('SubmissionBoxesSummary — a handed-in box that is still open', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, language: 'cz' } as never);
  });
  afterEach(cleanup);

  const seed = () =>
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '1' }),
        box({ name: 'Bez termínu', deadline: '', odevzdavarnaId: '2' }),
        box({
          name: 'Zadání',
          deadline: '12.10.2026 12:00',
          fileCount: 1,
          section: 'submitted',
          odevzdavarnaId: '3',
        }),
      ],
    });

  it('shows it once with both sections expanded', () => {
    seed();
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    fireEvent.click(screen.getByTestId('submitted-boxes-toggle'));
    expect(screen.getAllByText('Zadání')).toHaveLength(1);
    expect(screen.getAllByTestId('submitted-box-row')).toHaveLength(1);
  });

  it('counts and lists only the boxes still to hand in as open', () => {
    seed();
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByText('2 otevřené')).toBeTruthy();
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    expect(screen.getAllByTestId('submission-open-row')).toHaveLength(2);
  });

  it('with only handed-in boxes open, the card is the "Odevzdáno" part alone', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Zadání', fileCount: 1, section: 'submitted', odevzdavarnaId: '3' }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.queryByTestId('submission-boxes-toggle')).toBeNull();
    expect(screen.queryByText(/otevřen/)).toBeNull();
    expect(screen.getByTestId('submitted-boxes-toggle')).toBeTruthy();
  });
});
