import { describe, it, expect, vi, beforeEach } from 'vitest';

const { idb, fetchPastSemesterData } = vi.hoisted(() => ({
  idb: new Map<string, unknown>(),
  fetchPastSemesterData: vi.fn(),
}));
vi.mock('../../storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));
vi.mock('../../../api/subjects', () => ({ fetchPastSemesterData }));
vi.mock('../../../injector/iframeManager', () => ({ sendToIframe: vi.fn() }));

const { syncPastSemesters } = await import('../syncPastSemesters');

const PERIODS = [
  { id: '829', label: 'ZS 2026/2027' },
  { id: '815', label: 'LS 2025/2026' },
] as never;
const fresh = { subjects: { data: { NEW: {} } }, attendance: {} };

/**
 * The cache is keyed by period alone, and two studies at one faculty share
 * period ids. Without the study on the entry, switching studies served the
 * other study's past semester as this one's.
 */
describe('syncPastSemesters across studies', () => {
  beforeEach(() => {
    idb.clear();
    fetchPastSemesterData.mockReset().mockResolvedValue(fresh);
  });

  it("refetches a past semester cached for the student's other study", async () => {
    idb.set('past_semester_815', { studium: '900011', subjects: { data: {} }, attendance: {} });
    await syncPastSemesters('900012', '829', PERIODS);
    expect(fetchPastSemesterData).toHaveBeenCalledWith('900012', '815');
    expect(idb.get('past_semester_815')).toMatchObject({ studium: '900012' });
  });

  // Entries written before this change carry no study. Refetching all of
  // them would send every student's whole past at IS on the first boot.
  it('keeps an unstamped entry from before, and an entry for this study', async () => {
    idb.set('past_semester_815', { subjects: { data: {} }, attendance: {} });
    await syncPastSemesters('900012', '829', PERIODS);
    idb.set('past_semester_815', { studium: '900012', subjects: { data: {} }, attendance: {} });
    await syncPastSemesters('900012', '829', PERIODS);
    expect(fetchPastSemesterData).not.toHaveBeenCalled();
  });
});
