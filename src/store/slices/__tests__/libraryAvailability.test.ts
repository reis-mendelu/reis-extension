import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/libraryAvailability', () => ({
  fetchLibraryAvailability: vi.fn(),
}));

import { useAppStore } from '@/store/useAppStore';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';
import { LIBRARY_ROOMS } from '@/data/map/libraryRooms';

const room = LIBRARY_ROOMS[0]!;
const SHARED = 'shared-scheduling-mailbox-guid';

describe('loadLibraryAvailability', () => {
  beforeEach(() => {
    useAppStore.setState({ libraryAvailability: {}, libraryAvailabilityLoaded: false });
    vi.clearAllMocks();
    // The Bookings API returns every room under ONE shared staff GUID, keyed
    // apart only by serviceId (see indexAvailabilityByRoom).
    vi.mocked(fetchLibraryAvailability).mockResolvedValue([
      {
        staffGuid: SHARED,
        serviceId: room.serviceId,
        webUrl: 'u',
        leadMinutes: room.leadMinutes,
        blocks: [],
      },
    ]);
  });

  it("keys availability by each room's own staffGuid, matched on serviceId", async () => {
    await useAppStore.getState().loadLibraryAvailability();
    const map = useAppStore.getState().libraryAvailability;
    expect(map[room.staffGuid]?.webUrl).toBe('u');
    // Stored object's guid is rewritten to its key, not the shared API mailbox guid.
    expect(map[room.staffGuid]?.staffGuid).toBe(room.staffGuid);
    // The shared API guid must NOT survive as a key (that was the display bug).
    expect(map[SHARED]).toBeUndefined();
    expect(useAppStore.getState().libraryAvailabilityLoaded).toBe(true);
  });

  it('does not refetch once loaded', async () => {
    await useAppStore.getState().loadLibraryAvailability();
    await useAppStore.getState().loadLibraryAvailability();
    expect(fetchLibraryAvailability).toHaveBeenCalledTimes(1);
  });
});
