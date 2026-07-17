import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLibraryAvailability } from '@/api/libraryAvailability';

afterEach(() => vi.restoreAllMocks());

describe('fetchLibraryAvailability', () => {
  it('maps the edge payload to RoomAvailability with parsed blocks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              rooms: [
                {
                  staffGuid: 'g1',
                  serviceId: 's1',
                  webUrl: 'https://book/s1',
                  leadMinutes: 60,
                  items: [
                    {
                      status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
                      startDateTime: { dateTime: '2026-07-17T08:00:00', timeZone: 'x' },
                      endDateTime: { dateTime: '2026-07-17T12:00:00', timeZone: 'x' },
                    },
                  ],
                },
              ],
            }),
            { status: 200 }
          )
      )
    );
    const out = await fetchLibraryAvailability();
    expect(out).toHaveLength(1);
    expect(out[0]!.staffGuid).toBe('g1'); // safe: length asserted above
    expect(out[0]!.blocks[0]).toEqual({
      status: 'AVAILABLE',
      start: '2026-07-17T08:00:00',
      end: '2026-07-17T12:00:00',
    });
  });

  it('returns [] on network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    expect(await fetchLibraryAvailability()).toEqual([]);
  });
});
