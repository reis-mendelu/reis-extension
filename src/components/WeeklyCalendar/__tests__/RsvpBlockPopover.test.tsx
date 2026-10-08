import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  const withdrawRsvpBlock = vi.fn(async () => {});

  beforeEach(() => {
    withdrawRsvpBlock.mockClear();
    useAppStore.setState({ language: 'cz', withdrawRsvpBlock } as never);
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

  it('removes it by withdrawing the RSVP, then closes', () => {
    const onClose = vi.fn();
    render(<RsvpBlockPopover event={block} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat z kalendáře' }));
    expect(withdrawRsvpBlock).toHaveBeenCalledWith('rsvp:e1');
    expect(onClose).toHaveBeenCalled();
  });
});
