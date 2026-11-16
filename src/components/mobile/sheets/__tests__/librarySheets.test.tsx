import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const bookAndRecord = vi.fn();
const cancelAndRemove = vi.fn();
vi.mock('../../../../mobile/library/bookingActions', () => ({
  bookAndRecord: (...a: unknown[]) => bookAndRecord(...a),
  cancelAndRemove: (...a: unknown[]) => cancelAndRemove(...a),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { LibraryBookSheet } from '../LibraryBookSheet';
import { LibraryCancelSheet } from '../LibraryCancelSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { LIBRARY_ROOMS } from '../../../../data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const sheet = { featureId: room.featureId, day: '2026-11-10', from: 15, to: 17 };

beforeEach(() => {
  bookAndRecord.mockReset();
  cancelAndRemove.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  useAppStore.setState({ language: 'cz', customEvents: [] } as never);
});

describe('LibraryBookSheet', () => {
  it('says what will be booked and books once, locking the button while it waits', async () => {
    let done!: (v: unknown) => void;
    bookAndRecord.mockReturnValue(new Promise((r) => (done = r)));
    const onClose = vi.fn();
    const own = { kind: 'libraryBook' as const, ...sheet };
    useAppStore.setState({ mobileSheets: [own] } as never);
    render(<LibraryBookSheet sheet={own} onClose={onClose} />);
    expect(screen.getByText('15:00–17:00')).toBeInTheDocument();
    expect(screen.getByText('Budova A, −1. patro')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Rezervovat' });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'Rezervuji…' }));
    expect(bookAndRecord).toHaveBeenCalledTimes(1);
    expect(bookAndRecord.mock.calls[0]![0]).toMatchObject({ from: 15, to: 17 });
    // Swiping the sheet away mid-booking does nothing.
    fireEvent.click(screen.getByRole('button', { name: /zavřít|close/i }));
    expect(onClose).not.toHaveBeenCalled();
    done({ kind: 'ok', events: [] });
    // Closed by the answer, as the sheet on top.
    await waitFor(() => expect(useAppStore.getState().mobileSheets).toEqual([]));
    expect(toast.success).toHaveBeenCalled();
  });

  it('tells the student when the hour was taken, and when the library did not answer', async () => {
    bookAndRecord.mockResolvedValueOnce({ kind: 'taken' });
    const { unmount } = render(<LibraryBookSheet sheet={sheet} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Některou z hodin mezitím někdo vzal. Nic se nerezervovalo.'
      )
    );
    unmount();
    bookAndRecord.mockResolvedValueOnce({ kind: 'unknown' });
    render(<LibraryBookSheet sheet={sheet} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenLastCalledWith(expect.stringContaining('zkontroluj e-mail'))
    );
  });
});

describe('LibraryCancelSheet', () => {
  const block = {
    id: 'library:A1',
    title: 'Studovna – Individuální studovna 1',
    date: '20261110',
    startTime: '15:00',
    endTime: '16:00',
    libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
  };

  it('offers only cancelling the real booking, and says an e-mail follows', () => {
    useAppStore.setState({ customEvents: [block] } as never);
    render(<LibraryCancelSheet eventId="library:A1" onClose={() => undefined} />);
    expect(screen.getByText(/pošle e-mail o zrušení/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zrušit rezervaci v knihovně' })).toBeInTheDocument();
    expect(screen.queryByText(/jen z kalendáře/i)).toBeNull();
  });

  it('cancels, confirms and closes', async () => {
    useAppStore.setState({ customEvents: [block] } as never);
    cancelAndRemove.mockResolvedValue({ kind: 'ok' });
    // Opened from the booking's drawer: both close once the booking is gone.
    useAppStore.setState({
      mobileSheets: [
        { kind: 'libraryBooking', eventId: 'library:A1' },
        { kind: 'libraryCancel', eventId: 'library:A1' },
      ],
    } as never);
    render(<LibraryCancelSheet eventId="library:A1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit rezervaci v knihovně' }));
    await waitFor(() => expect(useAppStore.getState().mobileSheets).toEqual([]));
    expect(cancelAndRemove).toHaveBeenCalledWith('library:A1');
    expect(toast.success).toHaveBeenCalledWith('Rezervace zrušena.');
  });

  it('keeps going when the library did not answer', async () => {
    useAppStore.setState({ customEvents: [block] } as never);
    cancelAndRemove.mockResolvedValue({ kind: 'unknown' });
    render(<LibraryCancelSheet eventId="library:A1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit rezervaci v knihovně' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Zkontroluj e-mail'))
    );
  });

  it('offers to remove a block that has no cancel key, and only from the calendar', async () => {
    // Saved before storage kept libraryBooking (2026-11-16): a library id, nothing else.
    const legacy = {
      id: 'library:OLD',
      title: 'Studovna – Týmová 2',
      date: '20261120',
      startTime: '09:00',
      endTime: '11:00',
      room: 'Týmová 2',
    };
    useAppStore.setState({ customEvents: [legacy] } as never);
    useAppStore.setState({
      mobileSheets: [{ kind: 'libraryCancel', eventId: 'library:OLD' }],
    } as never);
    render(<LibraryCancelSheet eventId="library:OLD" onClose={() => undefined} />);
    expect(screen.getByText(/nemá k ní klíč/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat z kalendáře' }));
    await waitFor(() => expect(useAppStore.getState().mobileSheets).toEqual([]));
    expect(cancelAndRemove).not.toHaveBeenCalled();
    expect(useAppStore.getState().customEvents).toEqual([]);
  });
});
