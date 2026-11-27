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

import { cancelAndRemove } from '../bookingActions';
import { useAppStore } from '../../../store/useAppStore';
import {
  block,
  http,
  logWrites,
  resetCancelState,
  room,
  seed,
  stored,
  twoHours,
} from './cancelFixtures';

beforeEach(resetCancelState);

// An attempt that was interrupted (the app closed between its writes, before
// #737 made a cancel one transaction) can leave a split block beside the
// original. A retry reconciles both.
describe('cancelAndRemove after an interrupted attempt', () => {
  it('a retry never overwrites a block an earlier attempt saved and the student extended', async () => {
    // An earlier attempt cancelled 15:00, saved 16:00 as its own block and was
    // closed before the original went. The student then extended 16:00 to 18:00.
    const extended = {
      ...block,
      id: 'library:A1-16',
      startTime: '16:00',
      endTime: '18:00',
      libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2', 'S3'] },
    };
    await seed([twoHours, extended]);
    const log = logWrites();
    let n = 0;
    // The retry: 15:00 is gone already, 16:00 still fails.
    await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 200 : 500, data: {} }))
    );
    // It is stored again as memory holds it (S2 + S3), in case its first save
    // failed, in the same write that drops the original.
    expect(log).toEqual(['replace put library:A1-16 drop library:A1']);
    expect(useAppStore.getState().customEvents).toEqual([extended]);
    expect(await stored()).toEqual([extended]);
  });

  // An attempt that died after saving a split but before the original went
  // leaves both. The retry cancels hours the split still holds: they must
  // leave the split too, or the calendar shows a booking that is gone.
  it('a retry drops an earlier split block whose hour it has now cancelled', async () => {
    await seed([
      twoHours,
      {
        ...block,
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '17:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2'] },
      },
    ]);
    // 15:00 is gone already (404), 16:00 is cancelled now.
    let n = 0;
    const r = await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: n++ === 0 ? 404 : 200, data: {} }))
    );
    expect(r.kind).toBe('ok');
    expect(useAppStore.getState().customEvents).toEqual([]);
    expect(await stored()).toEqual([]);
  });

  it('a retry takes the cancelled hour out of an earlier split and keeps its newer key', async () => {
    // The earlier attempt cancelled 15:00 and saved 16:00–18:00 as A1-16; the
    // student then extended that block to 19:00 (S4, not part of A1).
    await seed([
      {
        ...block,
        endTime: '18:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S1', 'S2', 'S3'] },
      },
      {
        ...block,
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '19:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2', 'S3', 'S4'] },
      },
    ]);
    // The retry: 15:00 gone, 16:00 cancelled now, 17:00 fails.
    let n = 0;
    const r = await cancelAndRemove(
      'library:A1',
      vi.fn(async () => ({ status: [404, 200, 500][n++] ?? 500, data: {} }))
    );
    expect(r.left).toEqual(['S3']);
    const want = [
      expect.objectContaining({
        id: 'library:A1-17',
        startTime: '17:00',
        endTime: '19:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S3', 'S4'] },
      }),
    ];
    expect(useAppStore.getState().customEvents).toEqual(want);
    expect(await stored()).toEqual(want);
  });

  it('cancelling the leftover split also takes its hour out of the stale original', async () => {
    // The earlier attempt cancelled 15:00 and saved 16:00 as A1-16, then died
    // before A1 went. The student now cancels A1-16 itself.
    await seed([
      twoHours,
      {
        ...block,
        id: 'library:A1-16',
        startTime: '16:00',
        endTime: '17:00',
        libraryBooking: { featureId: room.featureId, selfServiceIds: ['S2'] },
      },
    ]);
    await cancelAndRemove('library:A1-16', http({ status: 200, data: {} }));
    // A1 keeps only 15:00 (its key reads 404 → gone the next time it is cancelled).
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
});
