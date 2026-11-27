import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The app's gate and its native transport: on in the phone and iPad apps, which is what this is.
const native = vi.hoisted(() => ({ http: vi.fn() }));
vi.mock('../transport', () => ({
  canBookLibrary: () => true,
  nativeBookingsHttp: native.http,
}));

import { cardPick, useLibraryStore, STALE_MS } from '../libraryStore';
import { useAppStore } from '../../../store/useAppStore';
import { clearDiagnostics, getDiagnostics } from '../../../utils/diagnostics/diagnosticLog';
import type { BookingsHttp } from '../bookingsBase';
import { LIBRARY_ROOMS } from '../../../data/map/libraryRooms';

const ok: BookingsHttp = vi.fn(async (req) => ({
  status: 200,
  data: {
    staffAvailabilityResponse: (req.data as { staffIds: string[] }).staffIds.map((staffId) => ({
      staffId,
      availabilityItems: [
        {
          status: 'BOOKINGSAVAILABILITYSTATUS_AVAILABLE',
          startDateTime: { dateTime: '2026-11-10T07:00:00' },
          endDateTime: { dateTime: '2026-11-10T19:00:00' },
        },
      ],
    })),
  },
}));
const now = new Date(2026, 10, 10, 6, 0);

beforeEach(() => {
  useLibraryStore.getState().reset();
  vi.mocked(ok).mockClear();
  native.http.mockReset();
  native.http.mockImplementation(ok);
  clearDiagnostics();
  useAppStore.setState({ mobileTab: 'calendar', mapSelection: null } as never);
});
afterEach(() => vi.useRealTimers());

describe('libraryStore: reading before the card opens', () => {
  it('starts the read when the student arrives on the map tab, so it is under way when they tap the pin', async () => {
    useAppStore.getState().setMobileTab('map');
    await vi.waitFor(() => expect(native.http).toHaveBeenCalledTimes(1));
    // Moving between other tabs, or staying on the map, asks nothing more.
    useAppStore.getState().setMobileTab('calendar');
    expect(native.http).toHaveBeenCalledTimes(1);
  });

  it('does not read for tabs that are not the map', () => {
    useAppStore.getState().setMobileTab('subjects');
    expect(native.http).not.toHaveBeenCalled();
  });
});

describe('libraryStore: a slow answer is remembered on the device', () => {
  it('keeps a line in the local diagnostic log when the library took 8 s or more', async () => {
    vi.useFakeTimers();
    const slow: BookingsHttp = async (req) => {
      await new Promise((r) => setTimeout(r, 9_000));
      return ok(req);
    };
    const p = useLibraryStore.getState().load(slow, now);
    await vi.advanceTimersByTimeAsync(9_000);
    await p;
    expect(getDiagnostics().some((e) => e.ctx === 'Library.slowRead')).toBe(true);
  });

  it('keeps nothing for a normal answer', async () => {
    await useLibraryStore.getState().load(ok, now);
    expect(getDiagnostics().some((e) => e.ctx === 'Library.slowRead')).toBe(false);
  });
});

describe('libraryStore.load', () => {
  it('reads every room in one request, a week ahead', async () => {
    await useLibraryStore.getState().load(ok, now);
    const s = useLibraryStore.getState();
    expect(s.status).toBe('ready');
    expect(Object.keys(s.blocks)).toHaveLength(LIBRARY_ROOMS.length);
    expect(ok).toHaveBeenCalledTimes(1);
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
    expect(ok).toHaveBeenCalledTimes(1);
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

describe('cardPick', () => {
  const now = new Date(2026, 10, 18, 9, 0);
  it('keeps the stored day and its pick while the day is today or later', () => {
    expect(cardPick({ day: '2026-11-19', picked: [9] }, now)).toEqual({
      day: '2026-11-19',
      picked: [9],
    });
  });
  it('drops a past day for the next open day, and its pick with it', () => {
    expect(cardPick({ day: '2026-11-16', picked: [9] }, now)).toEqual({
      day: '2026-11-18',
      picked: [],
    });
  });
  it('uses the shown day before one was picked, keeping a pick', () => {
    expect(cardPick({ day: null, picked: [10] }, now)).toEqual({ day: '2026-11-18', picked: [10] });
  });
});
