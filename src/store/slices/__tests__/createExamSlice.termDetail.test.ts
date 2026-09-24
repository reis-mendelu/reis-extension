import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('../../../services/storage', () => ({ IndexedDBService: { get: vi.fn(), set: vi.fn() } }));
vi.mock('../../../services/sync/SyncService', () => ({
  syncService: { triggerExamRefresh: vi.fn() },
}));
vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));
vi.mock('../../../api/termDetail', () => ({ fetchTermDetail: vi.fn() }));

import { createExamSlice } from '../createExamSlice';
import { fetchTermDetail } from '../../../api/termDetail';

/**
 * Opening a term on the phone fetches its detail page once, and keeps both the
 * Poznámka and the length from it — the length is what the term's detail row
 * shows for terms the sync never enriched (every one not registered).
 */
describe('createExamSlice — term detail', () => {
  let state: Record<string, unknown>;
  let slice: ReturnType<typeof createExamSlice>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = { studiumId: '1', obdobiId: '2' };
    const set = vi.fn((updater: unknown) => {
      const patch = typeof updater === 'function' ? updater({ ...state, ...slice }) : updater;
      Object.assign(state, patch);
      Object.assign(slice, patch);
    }) as Mock & Parameters<typeof createExamSlice>[0];
    const get = vi.fn(() => ({ ...slice, ...state })) as unknown as Parameters<
      typeof createExamSlice
    >[1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    slice = createExamSlice(set, get, {} as any);
  });

  it('stores the note and the duration from one request', async () => {
    vi.mocked(fetchTermDetail).mockResolvedValue({
      note: { text: 'Přineste kalkulačku', isEmphasized: false },
      durationMinutes: 25,
    });
    await slice.fetchExamNotePriority('t1');
    expect(fetchTermDetail).toHaveBeenCalledTimes(1);
    expect(slice.examNotes.t1?.text).toBe('Přineste kalkulačku');
    expect(slice.examTermDurations.t1).toBe(25);
  });

  it('records "no length" when IS left it empty', async () => {
    vi.mocked(fetchTermDetail).mockResolvedValue({ note: null, durationMinutes: null });
    await slice.fetchExamNotePriority('t2');
    expect(slice.examTermDurations.t2).toBeNull();
  });
});
