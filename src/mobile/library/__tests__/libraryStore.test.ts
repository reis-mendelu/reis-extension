import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLibraryStore, STALE_MS } from '../libraryStore';
import type { BookingsHttp } from '../bookingsBase';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';

const ok: BookingsHttp = vi.fn(async () => ({
  status: 200,
  data: {
    staffAvailabilityResponse: [
      {
        availabilityItems: [
          {
            status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
            startDateTime: { dateTime: '2026-11-10T07:00:00' },
            endDateTime: { dateTime: '2026-11-10T19:00:00' },
          },
        ],
      },
    ],
  },
}));
const now = new Date(2026, 10, 10, 6, 0);

beforeEach(() => {
  useLibraryStore.getState().reset();
  vi.mocked(ok).mockClear();
});

describe('libraryStore.load', () => {
  it('reads every room once, a week ahead', async () => {
    await useLibraryStore.getState().load(ok, now);
    const s = useLibraryStore.getState();
    expect(s.status).toBe('ready');
    expect(Object.keys(s.blocks)).toHaveLength(LIBRARY_ROOMS.length);
    expect(ok).toHaveBeenCalledTimes(LIBRARY_ROOMS.length);
    const body = vi.mocked(ok).mock.calls[0]![0].data as {
      startDateTime: { dateTime: string };
      endDateTime: { dateTime: string };
    };
    expect(body.startDateTime.dateTime).toBe('2026-11-10');
    expect(body.endDateTime.dateTime).toBe('2026-11-17');
  });

  it('does not ask again within the stale window', async () => {
    await useLibraryStore.getState().load(ok, now);
    await useLibraryStore.getState().load(ok, new Date(now.getTime() + STALE_MS - 1000));
    expect(ok).toHaveBeenCalledTimes(LIBRARY_ROOMS.length);
  });

  it('says offline when nothing answers, and keeps no blocks', async () => {
    const down: BookingsHttp = vi.fn(async () => {
      throw new Error('network');
    });
    await useLibraryStore.getState().load(down, now);
    const s = useLibraryStore.getState();
    expect(s.status).toBe('offline');
    expect(Object.values(s.blocks).every((b) => b === null)).toBe(true);
  });

  it('marks an hour taken locally after a booking', async () => {
    await useLibraryStore.getState().load(ok, now);
    const id = LIBRARY_ROOMS[0]!.featureId;
    useLibraryStore.getState().markTaken(id, '2026-11-10', 15);
    const blocks = useLibraryStore.getState().blocks[id]!;
    expect(blocks.some((b) => b.status === 'busy' && b.start === '2026-11-10T15:00')).toBe(true);
  });
});
