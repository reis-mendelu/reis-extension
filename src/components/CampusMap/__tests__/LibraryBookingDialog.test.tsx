import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryBookingDialog } from '../LibraryBookingDialog';
import { useAppStore } from '@/store/useAppStore';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;

beforeEach(() => {
  useAppStore.setState({ language: 'en', bookingStatus: {}, bookingError: {} });
});

describe('LibraryBookingDialog commitment', () => {
  it('keeps Confirm disabled until the show-up commitment is checked', () => {
    render(
      <LibraryBookingDialog room={room} slotIso="2026-07-22T11:00:00" onClose={() => {}} />
    );
    const confirm = screen.getByRole('button', { name: 'Confirm booking' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirm).toBeEnabled();

    fireEvent.click(screen.getByRole('checkbox')); // untick → gated again
    expect(confirm).toBeDisabled();
  });
});
