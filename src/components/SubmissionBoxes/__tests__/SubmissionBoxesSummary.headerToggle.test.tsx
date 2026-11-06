import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * "I can't click the entire odevzdávárny row to expand" (reIS Task List):
 * only the small "4 otevřené ⌄" pill toggled, so a tap on the title or on
 * "Nic k odevzdání do 14 dní" did nothing. The whole header is the one
 * disclosure button now, on both trees, since the card is shared.
 */
describe('SubmissionBoxesSummary header toggle', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, language: 'cz' } as never);
  });
  afterEach(cleanup);

  const nothingDue = () =>
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '1' }),
        box({ name: 'Zadání', deadline: '20.02.2027 12:00', odevzdavarnaId: '2' }),
      ],
      subjects: { data: { 'EBC-PJ': { subjectId: 'P1' } } },
    } as never);

  const expanded = () =>
    screen.getByTestId('submission-boxes-toggle').getAttribute('aria-expanded');

  it('a tap on the title toggles the card', () => {
    nothingDue();
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByText('Odevzdávárny'));
    expect(expanded()).toBe('true');
    fireEvent.click(screen.getByText('Odevzdávárny'));
    expect(expanded()).toBe('false');
  });

  it('a tap on "Nic k odevzdání do 14 dní" toggles the card', () => {
    nothingDue();
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    fireEvent.click(screen.getByText('Nic k odevzdání do 14 dní'));
    expect(expanded()).toBe('true');
    expect(screen.getAllByTestId('submission-open-row')).toHaveLength(2);
  });

  it('is one real button holding the title, with aria-expanded and aria-controls', () => {
    nothingDue();
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    const toggle = screen.getByTestId('submission-boxes-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(screen.getAllByRole('button', { expanded: false })).toEqual([toggle]);
    expect(toggle.contains(screen.getByText('Odevzdávárny'))).toBe(true);
    expect(toggle.textContent).toContain('2 otevřené');
    const controls = toggle.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBeTruthy();
  });

  it('a row in the expanded list opens its subject and leaves the card open', () => {
    const onOpen = vi.fn();
    nothingDue();
    render(<SubmissionBoxesSummary onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
    fireEvent.click(screen.getByText('Projects'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(expanded()).toBe('true');
    // The rows are outside the toggle, so they never nest a button in it.
    const toggle = screen.getByTestId('submission-boxes-toggle');
    for (const row of screen.getAllByTestId('submission-open-row')) {
      expect(toggle.contains(row)).toBe(false);
    }
  });
});

describe('SubmissionBoxesSummary header structure', () => {
  beforeEach(() => {
    useAppStore.setState({ now: NOW, language: 'cz' } as never);
  });
  afterEach(cleanup);

  it('due rows stay outside the toggle, collapsed and expanded', () => {
    useAppStore.setState({
      odevzdavarny: [
        box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59', odevzdavarnaId: '1' }),
        box({ name: 'Projects', deadline: '31.01.2027 04:27', odevzdavarnaId: '2' }),
      ],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    const toggle = screen.getByTestId('submission-boxes-toggle');
    expect(toggle.contains(screen.getByTestId('submission-due-row'))).toBe(false);
    expect(toggle.textContent).not.toContain('Nic k odevzdání');
    fireEvent.click(toggle);
    for (const row of screen.getAllByTestId('submission-open-row')) {
      expect(toggle.contains(row)).toBe(false);
    }
  });

  it('with nothing more to show, the header is no button at all', () => {
    useAppStore.setState({
      odevzdavarny: [box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59' })],
    });
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
    expect(screen.getByText('Odevzdávárny').closest('button')).toBeNull();
  });
});
