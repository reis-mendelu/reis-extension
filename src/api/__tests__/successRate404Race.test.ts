import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SubjectSuccessRate } from '../../types/documents';
import { fetchSubjectSuccessRates } from '../successRate';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { STORAGE_KEYS } from '../../services/storage/keys';

/**
 * A 404 for a subject keeps the stored entry and stamps it with the version,
 * so it is not asked for again until the version moves. The stamp used to be
 * put on the copy the call read when it STARTED. Two same-code fetches can be
 * in flight at once (`fetchSuccessRate` beside a batch); if the other one got
 * the fresh file and saved first, the late 404 wrote the old copy back over
 * it, stamped current — and the 30-day sync mark kept it there.
 *
 * Storage is the real `IndexedDBService` over fake-indexeddb.
 */

const V1 = '2026-02-10T09:00:00.000Z';
const V2 = '2026-09-22T12:17:27.977Z';

const rate = (newest: string, cdnVersion?: string): SubjectSuccessRate => ({
  courseCode: 'EBC-ST',
  lastUpdated: V2,
  stats: [
    {
      semesterName: `${newest} - PEF`,
      semesterId: '1',
      year: 2025,
      totalPass: 10,
      totalFail: 2,
      sourceUrl: 'https://is.mendelu.cz/x',
      type: 'exam',
      terms: [],
    },
  ],
  ...(cdnVersion ? { cdnVersion } : {}),
});

/** Each request waits until the test answers it, in the order the test picks. */
function heldCdn() {
  const pending: Array<(r: Response) => void> = [];
  let onRequest = () => {};
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pending.push(resolve);
          onRequest();
        })
    )
  );
  return {
    requests: (n: number) =>
      new Promise<void>((resolve) => {
        onRequest = () => pending.length >= n && resolve();
        onRequest();
      }),
    answer: (i: number, r: Response) => pending[i]!(r),
  };
}

const stored = async () =>
  (await IndexedDBService.get('success_rates', 'current'))?.data['EBC-ST'];

beforeEach(async () => {
  await IndexedDBService.set('success_rates', 'current', {
    lastUpdated: V1,
    data: { 'EBC-ST': rate('ZS 2025/2026', V1) },
  });
  await IndexedDBService.delete('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC);
});

afterEach(() => vi.unstubAllGlobals());

describe('fetchSubjectSuccessRates — a late 404 beside a fresh fetch', () => {
  it('stamps what is stored now, not the copy it started from', async () => {
    const cdn = heldCdn();
    const late404 = fetchSubjectSuccessRates(['EBC-ST'], V2);
    const fresh = fetchSubjectSuccessRates(['EBC-ST'], V2);
    await cdn.requests(2);

    cdn.answer(1, new Response(JSON.stringify(rate('LS 2025/2026'))));
    await fresh;
    cdn.answer(0, new Response('', { status: 404 }));
    const result = await late404;

    const entry = await stored();
    expect(entry?.stats[0]?.semesterName).toBe('LS 2025/2026 - PEF');
    expect(entry?.cdnVersion).toBe(V2);
    expect(result.data['EBC-ST']?.stats[0]?.semesterName).toBe('LS 2025/2026 - PEF');
  });

  it('still stamps the kept entry on a 404 alone', async () => {
    const cdn = heldCdn();
    const call = fetchSubjectSuccessRates(['EBC-ST'], V2);
    await cdn.requests(1);
    cdn.answer(0, new Response('', { status: 404 }));
    await call;

    const entry = await stored();
    expect(entry?.stats[0]?.semesterName).toBe('ZS 2025/2026 - PEF');
    expect(entry?.cdnVersion).toBe(V2);
    const synced = (await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC)) as
      | Record<string, number>
      | undefined;
    expect(synced?.['EBC-ST']).toBeTypeOf('number');
  });

  it('marks nothing synced for a 404 with nothing stored', async () => {
    await IndexedDBService.delete('success_rates', 'current');
    const cdn = heldCdn();
    const call = fetchSubjectSuccessRates(['EBC-ST'], V2);
    await cdn.requests(1);
    cdn.answer(0, new Response('', { status: 404 }));
    const result = await call;

    expect(result.data['EBC-ST']).toBeUndefined();
    const synced = (await IndexedDBService.get('meta', STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC)) as
      | Record<string, number>
      | undefined;
    expect(synced?.['EBC-ST']).toBeUndefined();
  });
});
