import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * "reis neukazuje hotove a obodovane projekty" (reIS Task List): the card on
 * Předměty listed only open boxes, so handed-in and graded work showed only
 * inside each subject's Záznamník. The card now has an "Odevzdáno (N)"
 * disclosure, collapsed by default, with the points or "čeká na hodnocení".
 */
describe('SubmissionBoxesSummary — Odevzdáno', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      obdobiId: '900',
      subjects: { data: { 'EBC-PJ': { subjectId: 'P1' } } },
    } as never);
  });
  afterEach(cleanup);

  const graded = box({
    name: 'Specifikace projektu',
    odevzdavarnaId: '10',
    deadline: '20.09.2026 23:59',
    fileCount: 1,
    section: 'submitted',
    isOpen: false,
    points: '1',
    obdobi: '900',
  });
  const ungraded = box({
    name: 'Rozpracovaný projekt',
    odevzdavarnaId: '11',
    deadline: '30.09.2026 23:59',
    fileCount: 1,
    section: 'submitted',
    isOpen: false,
    obdobi: '900',
  });

  it('counts the handed-in boxes and lists them only when expanded, newest first', () => {
    useAppStore.setState({ odevzdavarny: [box({ name: 'Otevřená' }), graded, ungraded] });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    const toggle = screen.getByTestId('submitted-boxes-toggle');
    expect(toggle.textContent).toContain('Odevzdáno (2)');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Specifikace projektu')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const rows = screen.getAllByTestId('submitted-box-row');
    expect(rows.map((r) => within(r).getByText(/projekt/).textContent)).toEqual([
      'Rozpracovaný projekt',
      'Specifikace projektu',
    ]);
    expect(rows[0]!.textContent).toContain('čeká na hodnocení');
    expect(rows[1]!.textContent).toContain('1 b.');
  });

  it('lists a box handed in while it is still open', () => {
    useAppStore.setState({
      odevzdavarny: [box({ name: 'Hotovo', fileCount: 1, section: 'submitted', obdobi: '900' })],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByTestId('submitted-boxes-toggle'));
    expect(screen.getByTestId('submitted-box-row').textContent).toContain('Hotovo');
  });

  it('opens the subject on Záznamník from a row', () => {
    const onOpen = vi.fn();
    useAppStore.setState({ odevzdavarny: [graded] });
    render(<SubmissionBoxesSummary onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('submitted-boxes-toggle'));
    fireEvent.click(screen.getByTestId('submitted-box-row'));
    expect(onOpen).toHaveBeenCalledWith('EBC-PJ', graded);
  });

  it('shows just the Odevzdáno part when nothing is open', () => {
    useAppStore.setState({ odevzdavarny: [graded] });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByTestId('submission-boxes-summary')).toBeTruthy();
    expect(screen.getByText('Odevzdávárny')).toBeTruthy();
    expect(screen.getByTestId('submitted-boxes-toggle').textContent).toContain('Odevzdáno (1)');
    expect(screen.queryByText(/otevřen/)).toBeNull();
    expect(screen.queryByText('Nic k odevzdání do 14 dní')).toBeNull();
  });

  it('stays hidden with nothing open and nothing handed in', () => {
    useAppStore.setState({
      odevzdavarny: [box({ isOpen: false, section: 'closed', fileCount: 0 })],
    });
    const { container } = render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it("leaves out the previous period's closed boxes, keeping its still-open ones", () => {
    useAppStore.setState({
      odevzdavarny: [
        { ...graded, obdobi: '899', name: 'Loňský projekt', odevzdavarnaId: '20' },
        box({
          name: 'Zkouškový projekt',
          odevzdavarnaId: '21',
          fileCount: 1,
          section: 'submitted',
          obdobi: '899',
        }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByTestId('submitted-boxes-toggle'));
    const rows = screen.getAllByTestId('submitted-box-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('Zkouškový projekt');
  });

  it('has no Odevzdáno part when nothing is handed in', () => {
    useAppStore.setState({ odevzdavarny: [box({ name: 'Otevřená' })] });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.queryByTestId('submitted-boxes-toggle')).toBeNull();
  });
});
