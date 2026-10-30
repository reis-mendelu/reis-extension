import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const bookAndRecord = vi.fn();
const cancelAndRemove = vi.fn();
vi.mock('../../../../mobile/library/bookingActions', () => ({
  bookAndRecord: (...a: unknown[]) => bookAndRecord(...a),
  cancelAndRemove: (...a: unknown[]) => cancelAndRemove(...a),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { LibraryBookSheet } from '../LibraryBookSheet';
import { LibraryCancelSheet } from '../LibraryCancelSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { LIBRARY_ROOMS } from '../../../../data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const sheet = { featureId: room.featureId, day: '2026-11-10', hour: 15 };

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
    render(<LibraryBookSheet sheet={sheet} onClose={onClose} />);
    expect(screen.getByText('15:00–16:00')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Rezervovat' });
    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('button', { name: 'Rezervuji…' }));
    expect(bookAndRecord).toHaveBeenCalledTimes(1);
    done({ kind: 'ok', event: {} });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('tells the student when the hour was taken, and when the library did not answer', async () => {
    bookAndRecord.mockResolvedValueOnce({ kind: 'taken' });
    const { unmount } = render(<LibraryBookSheet sheet={sheet} onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rezervovat' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Tuhle hodinu mezitím někdo vzal.')
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
    libraryBooking: { featureId: room.featureId, selfServiceId: 'S1' },
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
    const onClose = vi.fn();
    render(<LibraryCancelSheet eventId="library:A1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit rezervaci v knihovně' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
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
});
