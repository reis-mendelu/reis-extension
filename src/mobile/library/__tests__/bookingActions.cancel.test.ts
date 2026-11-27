import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../utils/userParams', () => ({
  getUserParams: vi.fn(async () => ({
    fullName: 'Jana Nováková',
    email: 'xnovak7@mendelu.cz',
    username: 'xnovak7',
    studentId: '123456',
    facultyLabel: 'PEF',
  })),
}));

import { bookAndRecord, cancelAndRemove } from '../bookingActions';
import { useLibraryStore } from '../libraryStore';
import { useAppStore } from '../../../store/useAppStore';
import type { BookingsHttp } from '../bookingsBase';
import {
  block,
  http,
  logWrites,
  now,
  resetCancelState,
  room,
  seed,
  stored,
  twoHours,
} from './cancelFixtures';

beforeEach(resetCancelState);

describe('cancelAndRemove', () => {
  it('removes the block once the booking is cancelled', async () => {
    useAppStore.setState({ customEvents: [block] });
    const r = await cancelAndRemove('library:A1', http({ status: 200, data: {} }));
    expect(r.kind).toBe('ok');
    expect(useAppStore.getState().customEvents).toHaveLength(0);
  });
  it('keeps the block when the cancel failed', async () => {
    useAppStore.setState({ customEvents: [block] });
    const r = await cancelAndRemove('library:A1', http({ status: 500, data: {} }));
    expect(r.kind).toBe('failed');
    expect(useAppStore.getState().customEvents).toHaveLength(1);
  });
  it('keeps only the hours it could not cancel, each with its own key and time', async () => {
    useAppStore.setState({
      customEvents: [
        {
          ...block,
          endTime: '17:00',
          libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2'] },
        },
      ],
    });
    let n = 0;
    const h: BookingsHttp = vi.fn(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }));
    const r = await cancelAndRemove('library:A1', h);
    expect(r).toEqual({ kind: 'failed', status: 500, left: ['S2'] });
    // 15:00 was cancelled; 16:00 stays, as its own 16:00–17:00 block.
    expect(useAppStore.getState().customEvents).toEqual([
      expect.objectContaining({
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '17:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2'] },
      }),
    ]);
  });

  it('saves the hours it keeps and drops the original in one write', async () => {
    await seed([twoHours]);
    const log = logWrites();
    let n = 0;
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }))
    );
    expect(log).toEqual(['replace put library:A1-16 drop library:A1']);
    const want = [
      expect.objectContaining({
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '17:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2'] },
      }),
    ];
    expect(useAppStore.getState().customEvents).toEqual(want);
    expect(await stored()).toEqual(want);
  });
  it('rewrites the original block in place when its first hour is kept', async () => {
    await seed([twoHours]);
    const log = logWrites();
    let n = 0;
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 500 : 200, data: {} }))
    );
    expect(log).toEqual(['replace put library:A1 drop ']);
    const want = [
      expect.objectContaining({
        id: 'library:A1',
        startTime: '15:00',
        endTime: '16:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1'] },
      }),
    ];
    expect(useAppStore.getState().customEvents).toEqual(want);
    expect(await stored()).toEqual(want);
  });

  it('splits around a cancelled hour in one write', async () => {
    await seed([
      {
        ...block,
        endTime: '18:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2', 'S3'] },
      },
    ]);
    const log = logWrites();
    let n = 0;
    // 15:00 fails, 16:00 is cancelled, 17:00 fails.
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 1 ? 200 : 500, data: {} }))
    );
    expect(log).toEqual(['replace put library:A1,library:A1-17 drop ']);
    const ids = (es: { id: string }[]) => es.map((e) => e.id).sort();
    expect(ids(useAppStore.getState().customEvents)).toEqual(['library:A1', 'library:A1-17']);
    expect(ids(await stored())).toEqual(['library:A1', 'library:A1-17']);
  });

  it('frees the cancelled hours for booking again, and reads afresh next time', async () => {
    useAppStore.setState({ customEvents: [block] });
    useLibraryStore.setState({
      blocks: {
        [room.featureId]: [
          { status: 'free', start: '2026-11-10T07:00', end: '2026-11-10T19:00' },
          { status: 'busy', start: '2026-11-10T15:00', end: '2026-11-10T16:00' },
        ],
      },
      fetchedAt: 1,
    });
    await cancelAndRemove('library:A1', http({ status: 200, data: {} }));
    expect(useLibraryStore.getState().blocks[room.featureId]).toHaveLength(1);
    expect(useLibraryStore.getState().fetchedAt).toBeNull();
  });

  it('refuses a second write while one is running', async () => {
    useAppStore.setState({ customEvents: [block] });
    useLibraryStore.setState({ writing: true });
    expect((await cancelAndRemove('library:A1', http({ status: 200, data: {} }))).kind).toBe(
      'busy'
    );
    expect(
      (
        await bookAndRecord({
          http: http({ status: 200, data: {} }),
          room,
          day: '2026-11-10',
          from: 15,
          to: 16,
          lang: 'cz',
          now,
        })
      ).kind
    ).toBe('busy');
    useLibraryStore.setState({ writing: false });
  });
});
