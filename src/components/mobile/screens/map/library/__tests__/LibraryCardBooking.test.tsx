import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

const wide = vi.hoisted(() => ({ value: false }));
vi.mock('../../../../../../hooks/ui/useWideViewport', () => ({
  useWideViewport: () => wide.value,
}));

// The app's gate: on in the phone and iPad apps, which is what these tests are.
vi.mock('../../../../../../mobile/library/transport', () => ({
  canBookLibrary: () => true,
  nativeBookingsHttp: vi.fn(),
}));

const booking = vi.hoisted(() => ({ bookAndRecord: vi.fn() }));
vi.mock('../../../../../../mobile/library/bookingActions', () => booking);

import { LibraryCard } from '../LibraryCard';
import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { NOW, bar, cell, plus, seedCard, team1 } from './libraryCardFixture';

beforeEach(() => {
  wide.value = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  seedCard();
  booking.bookAndRecord.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('LibraryCard: booking', () => {
  it('the first booking on a phone goes through the confirm sheet, with the data sentence', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(plus('15:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets[0]).toEqual({
      kind: 'libraryBook',
      featureId: team1!.featureId,
      day: '2026-11-16',
      from: 14,
      to: 16,
    });
    expect(booking.bookAndRecord).not.toHaveBeenCalled();
  });

  it('after that the check books straight away, with no sheet', async () => {
    booking.bookAndRecord.mockResolvedValue({ kind: 'ok' });
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(plus('15:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    await vi.waitFor(() => expect(booking.bookAndRecord).toHaveBeenCalledTimes(1));
    expect(booking.bookAndRecord).toHaveBeenCalledWith(
      expect.objectContaining({ room: team1, day: '2026-11-16', from: 14, to: 16 })
    );
    // The pick is spent once it is booked.
    await vi.waitFor(() => expect(bar()).toBeNull());
  });

  it('keeps the pick when the booking did not go through', async () => {
    booking.bookAndRecord.mockResolvedValue({ kind: 'taken' });
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    await vi.waitFor(() => expect(booking.bookAndRecord).toHaveBeenCalled());
    expect(bar()).toBeTruthy();
  });

  it('the “i” says what the library receives, any time', () => {
    useLibraryStore.setState({ noticeSeen: true });
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(screen.queryByText(/Knihovna dostane/)).toBeNull();
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Co knihovna dostane' }));
    expect(screen.getByText(/Knihovna dostane tvé jméno/)).toBeTruthy();
  });

  it('the X clears the pick', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Zrušit výběr' }));
    expect(bar()).toBeNull();
    expect(useLibraryStore.getState().picked).toEqual([]);
  });

  it('on the iPad the first booking confirms inline in the bar, not in a sheet', () => {
    wide.value = true;
    render(<LibraryCard view={{ featureId: null }} flush />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    expect(screen.getByTestId('library-confirm')).toBeTruthy();
  });

  it('drops a pick whose cell was taken meanwhile', () => {
    render(<LibraryCard view={{ featureId: null }} />);
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(bar()).toBeTruthy();
    act(() => useLibraryStore.getState().markTaken(team1!.featureId, '2026-11-16', 14));
    expect(bar()).toBeNull();
  });
});
