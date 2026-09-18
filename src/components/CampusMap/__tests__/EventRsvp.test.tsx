import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventRsvp } from '../EventRsvp';
import { useAppStore } from '../../../store/useAppStore';

/**
 * One answer, not two.
 *
 * "Půjdu" and "Mám zájem" asked the student to grade an intention before they
 * had decided anything, and nothing downstream read the difference: the
 * reminder fires for either, and so does the calendar block.
 */
describe('EventRsvp', () => {
  const setRsvp = vi.fn();

  beforeEach(() => {
    setRsvp.mockReset();
    useAppStore.setState({
      language: 'cz',
      rsvp: {},
      rsvpCounts: { e1: { going: 4, interested: 7 } },
      setRsvp,
    } as never);
  });

  it('offers a single button', () => {
    render(<EventRsvp eventId="e1" accent="#00a0e3" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Mám zájem/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Půjdu/ })).toBeNull();
  });

  it('counts every answer under one label, old wording included', () => {
    render(<EventRsvp eventId="e1" accent="#00a0e3" />);
    expect(screen.getByText('11')).toBeInTheDocument();
  });

  it('answers as interested', () => {
    render(<EventRsvp eventId="e1" accent="#00a0e3" />);
    fireEvent.click(screen.getByRole('button'));
    expect(setRsvp).toHaveBeenCalledWith('e1', 'interested');
  });

  it('un-answers a legacy Going by sending the answer back unchanged', () => {
    useAppStore.setState({ rsvp: { e1: 'going' } } as never);
    render(<EventRsvp eventId="e1" accent="#00a0e3" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button'));
    expect(setRsvp).toHaveBeenCalledWith('e1', 'going');
  });
});
