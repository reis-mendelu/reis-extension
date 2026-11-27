import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';

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

import { useAppStore } from '../../../../../../store/useAppStore';
import { useLibraryStore } from '../../../../../../mobile/library/libraryStore';
import { renderPanel } from './renderPanel';
import { NOW, bar, cell, ind1, plus, seedCard, team1 } from './libraryCardFixture';

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
    renderPanel();
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
    renderPanel();
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
    renderPanel();
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    await vi.waitFor(() => expect(booking.bookAndRecord).toHaveBeenCalled());
    expect(bar()).toBeTruthy();
  });

  it('the “i” says what the library receives, any time', () => {
    useLibraryStore.setState({ noticeSeen: true });
    renderPanel();
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(screen.queryByText(/Knihovna dostane/)).toBeNull();
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Co knihovna dostane' }));
    expect(screen.getByText(/Knihovna dostane tvé jméno/)).toBeTruthy();
  });

  it('the X clears the pick', () => {
    renderPanel();
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Zrušit výběr' }));
    expect(bar()).toBeNull();
    expect(useLibraryStore.getState().picked).toEqual([]);
  });

  it('on the iPad the first booking confirms inline in the bar, not in a sheet', () => {
    wide.value = true;
    renderPanel(true);
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
    expect(screen.getByTestId('library-confirm')).toBeTruthy();
  });

  it('on a short wide window (a landscape phone) the first booking opens the sheet instead', () => {
    wide.value = true;
    const height = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 390, configurable: true });
    try {
      renderPanel(true);
      fireEvent.click(cell('Týmová 1', '14:00'));
      fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
      expect(useAppStore.getState().mobileSheets[0]).toMatchObject({ kind: 'libraryBook' });
      expect(screen.queryByTestId('library-confirm')).toBeNull();
    } finally {
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
    }
  });

  it('forgets a pick from a day that has passed, in the footer and in the store', () => {
    useLibraryStore.setState({ day: '2026-11-13', room: team1!.featureId, picked: [14] });
    renderPanel();
    expect(bar()).toBeNull();
    expect(useLibraryStore.getState()).toMatchObject({ room: null, picked: [] });
  });

  it('drops a pick whose cell was taken meanwhile', () => {
    renderPanel();
    fireEvent.click(cell('Týmová 1', '14:00'));
    expect(bar()).toBeTruthy();
    const before = useLibraryStore.getState().blocks[team1!.featureId];
    act(() => useLibraryStore.getState().markTaken(team1!.featureId, '2026-11-16', 14));
    expect(bar()).toBeNull();
    // Gone from the store too, so freeing the cell again does not bring the pick back.
    expect(useLibraryStore.getState()).toMatchObject({ room: null, picked: [] });
    act(() =>
      useLibraryStore.setState({
        blocks: { ...useLibraryStore.getState().blocks, [team1!.featureId]: before! },
      })
    );
    expect(bar()).toBeNull();
  });

  it('a booking that finishes later does not clear a newer pick', async () => {
    let finish: (r: { kind: 'ok' }) => void = () => undefined;
    booking.bookAndRecord.mockReturnValue(new Promise((res) => (finish = res)));
    useLibraryStore.setState({ noticeSeen: true });
    renderPanel();
    fireEvent.click(cell('Týmová 1', '14:00'));
    fireEvent.click(within(bar()!).getByRole('button', { name: 'Rezervovat' }));
    // While the library answers, the student picks another room.
    fireEvent.click(cell('Individuální 1', '16:00'));
    await act(async () => finish({ kind: 'ok' }));
    expect(useLibraryStore.getState()).toMatchObject({ room: ind1!.featureId, picked: [16] });
  });
});
