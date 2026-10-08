import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RsvpBlockPopover } from '../RsvpBlockPopover';
import { useAppStore } from '../../../store/useAppStore';
import type { CalendarCustomEvent } from '../../../types/calendarTypes';

const block: CalendarCustomEvent = {
  id: 'rsvp:e1',
  title: 'Flag Party',
  date: '20261121',
  startTime: '19:00',
  endTime: '20:30',
  room: 'Zlatá loď',
};

describe('RsvpBlockPopover — an answered society event in the desktop calendar', () => {
  // Succeeds by default: the answer is withdrawn, as setRsvp would on a 200.
  const withdrawRsvpBlock = vi.fn(async () => {
    useAppStore.setState({ rsvp: {} } as never);
  });

  beforeEach(() => {
    withdrawRsvpBlock.mockClear();
    useAppStore.setState({
      language: 'cz',
      rsvp: { e1: 'interested' },
      rsvpLoaded: true,
      withdrawRsvpBlock,
    } as never);
  });

  it('shows the event, not an edit form', () => {
    render(<RsvpBlockPopover event={block} onClose={() => {}} />);
    expect(screen.getByText('Flag Party')).toBeInTheDocument();
    expect(screen.getByText(/19:00 – 20:30/)).toBeInTheDocument();
    expect(screen.getByText('Zlatá loď')).toBeInTheDocument();
    // The custom-event modal's inputs are what let a student "move" a block
    // the next reconciliation silently moved back.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('is a modal dialog named by its heading, with focus inside it', () => {
    render(<RsvpBlockPopover event={block} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Flag Party' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).not.toHaveAttribute('aria-label');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('removes it by withdrawing the RSVP, then closes', async () => {
    const onClose = vi.fn();
    render(<RsvpBlockPopover event={block} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat z kalendáře' }));
    expect(withdrawRsvpBlock).toHaveBeenCalledWith('rsvp:e1');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stays open and says so when the write did not land', async () => {
    // setRsvp rolls a refused write back, so the answer is still held after.
    withdrawRsvpBlock.mockImplementationOnce(async () => {});
    const onClose = vi.fn();
    render(<RsvpBlockPopover event={block} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat z kalendáře' }));
    expect(await screen.findByText(/Nepodařilo se/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cannot withdraw before the answers are read from disk', () => {
    // A cold boot restores the calendar before the answers: with no answer
    // held yet, the click would silently do nothing.
    useAppStore.setState({ rsvp: {}, rsvpLoaded: false } as never);
    render(<RsvpBlockPopover event={block} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Odebrat z kalendáře' })).toBeDisabled();
  });
});
