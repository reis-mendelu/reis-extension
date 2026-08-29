import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/libraryBooking', () => ({
  createLibraryBooking: vi.fn(),
}));
vi.mock('@/api/libraryAvailability', () => ({
  fetchLibraryAvailability: vi.fn(async () => []),
}));

import { useAppStore } from '@/store/useAppStore';
import { createLibraryBooking } from '@/api/libraryBooking';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';
import type { BookingIdentity } from '@/types/library';

const room = LIBRARY_ROOMS[0]!;
const slot = '2026-07-20T14:00:00';
const key = `${room.staffGuid}|${slot}`;
const identity: BookingIdentity = { name: 'Jan', email: 'j@mendelu.cz', studentId: '1' };

describe('bookRoom', () => {
  beforeEach(() => {
    useAppStore.setState({
      bookingStatus: {},
      bookingError: {},
      libraryAvailabilityLoaded: true,
    });
    vi.clearAllMocks();
  });

  it('marks success and force-refetches availability', async () => {
    vi.mocked(createLibraryBooking).mockResolvedValue({ ok: true, appointmentId: 'a1' });
    await useAppStore.getState().bookRoom(room, slot, identity);
    expect(useAppStore.getState().bookingStatus[key]).toBe('success');
    expect(fetchLibraryAvailability).toHaveBeenCalledTimes(1); // guard was reset
  });

  it('records the typed error on failure and does not refetch', async () => {
    vi.mocked(createLibraryBooking).mockResolvedValue({ ok: false, error: 'conflict' });
    await useAppStore.getState().bookRoom(room, slot, identity);
    expect(useAppStore.getState().bookingStatus[key]).toBe('error');
    expect(useAppStore.getState().bookingError[key]).toBe('conflict');
    expect(fetchLibraryAvailability).not.toHaveBeenCalled();
  });
});
