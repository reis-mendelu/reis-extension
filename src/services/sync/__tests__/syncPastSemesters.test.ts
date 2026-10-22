import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('../../storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => store.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void store.set(k, v)),
  },
}));
vi.mock('../../../api/subjects', () => ({ fetchPastSemesterData: vi.fn() }));
vi.mock('../../../injector/iframeManager', () => ({ sendToIframe: vi.fn() }));

import { syncPastSemesters } from '../syncPastSemesters';
import { fetchPastSemesterData } from '../../../api/subjects';
import { sendToIframe } from '../../../injector/iframeManager';

const subjects = { version: 1, lastUpdated: '', data: {} };
const periods = [
  { id: '829', label: 'ZS 2026/2027' },
  { id: '812', label: 'LS 2025/2026' },
];

// Past periods are fetched only for their subjects, which syncService merges in
// from this cache. Past attendance had no screen and is no longer carried.
describe('syncPastSemesters', () => {
  beforeEach(() => {
    store.clear();
    vi.mocked(fetchPastSemesterData).mockReset().mockResolvedValue(subjects);
    vi.mocked(sendToIframe).mockReset();
  });

  it('caches the subjects of each past period, and sends the iframe nothing', async () => {
    await syncPastSemesters('100000', '829', periods);

    expect(fetchPastSemesterData).toHaveBeenCalledExactlyOnceWith('100000', '812');
    expect(store.get('past_semester_812')).toEqual({ subjects });
    expect(sendToIframe).not.toHaveBeenCalled();
  });

  it('reuses a cached period, including one cached with attendance', async () => {
    store.set('past_semester_812', { subjects, attendance: {} });

    await syncPastSemesters('100000', '829', periods);

    expect(fetchPastSemesterData).not.toHaveBeenCalled();
  });
});
