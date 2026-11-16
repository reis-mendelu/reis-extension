import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const extendBooking = vi.fn();
vi.mock('../../../../mobile/library/bookingActions', () => ({
  extendBooking: (...a: unknown[]) => extendBooking(...a),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { LibraryBookingSheet } from '../LibraryBookingSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { useLibraryStore } from '../../../../mobile/library/libraryStore';

const booking = {
  id: 'library:A1',
  title: 'Studovna v knihovně',
  date: '20261118',
  startTime: '17:00',
  endTime: '18:00',
  room: 'Týmová 2',
  libraryBooking: { featureId: 57627, selfServiceIds: ['S1'] },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 16, 10, 0));
  extendBooking.mockReset();
  useAppStore.setState({
    language: 'cz',
    customEvents: [booking],
    mobileSheets: [],
    mobileTab: 'calendar',
    mapSelection: null,
  } as never);
  useLibraryStore.setState({
    blocks: { 57627: [{ status: 'free', start: '2026-11-18T07:00', end: '2026-11-18T19:00' }] },
    status: 'ready',
    fetchedAt: Date.now(),
    load: vi.fn(async () => undefined),
  } as never);
});
afterEach(() => vi.useRealTimers());

describe('LibraryBookingSheet', () => {
  it('reads like a subject: the library as eyebrow, the room as title, where and when', () => {
    render(<LibraryBookingSheet eventId="library:A1" onClose={() => undefined} />);
    expect(screen.getByText('KNIHOVNA')).toBeTruthy();
    expect(screen.getByText('Týmová 2')).toBeTruthy();
    expect(screen.getByText('Budova A, −1. patro')).toBeTruthy();
    expect(screen.getByText(/17:00–18:00/)).toBeTruthy();
    expect(screen.getByText('Potvrzeno')).toBeTruthy();
    expect(screen.getByText('6 míst · týmová studovna')).toBeTruthy();
  });

  it('offers one more hour while the next one is free, and books it', async () => {
    extendBooking.mockResolvedValue({ kind: 'ok', events: [] });
    render(<LibraryBookingSheet eventId="library:A1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Prodloužit do 19:00' }));
    await waitFor(() => expect(extendBooking).toHaveBeenCalledWith('library:A1', 'cz'));
    expect(toast.success).toHaveBeenCalledWith('Prodlouženo do 19:00');
  });

  it('cancels through the confirm sheet, and opens the room on the map', () => {
    render(<LibraryBookingSheet eventId="library:A1" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit rezervaci v knihovně' }));
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({
      kind: 'libraryCancel',
      eventId: 'library:A1',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Na mapě' }));
    expect(useAppStore.getState().mobileTab).toBe('map');
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'library', featureId: 57627 });
    expect(useLibraryStore.getState().day).toBe('2026-11-18');
  });

  it('says reIS cannot cancel a booking without a key, and offers no extension', () => {
    useAppStore.setState({
      customEvents: [
        { ...booking, libraryBooking: { featureId: 57627, selfServiceIds: [], unconfirmed: true } },
      ],
    } as never);
    render(<LibraryBookingSheet eventId="library:A1" onClose={() => undefined} />);
    expect(screen.getByText('reIS ji zrušit neumí')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Prodloužit/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Odebrat z kalendáře' })).toBeTruthy();
  });

  it('closes itself once the booking is gone', () => {
    const onClose = vi.fn();
    useAppStore.setState({ customEvents: [] } as never);
    render(<LibraryBookingSheet eventId="library:A1" onClose={onClose} />);
    expect(onClose).toHaveBeenCalled();
  });
});
