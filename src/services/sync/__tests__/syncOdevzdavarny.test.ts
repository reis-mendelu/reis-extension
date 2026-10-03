import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchOdevzdavarny = vi.fn();
vi.mock('../../../api/odevzdavarny', () => ({
  fetchOdevzdavarny: (...a: unknown[]) => fetchOdevzdavarny(...a),
}));
const idb = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(async () => {}) }));
vi.mock('../../storage/IndexedDBService', () => ({ IndexedDBService: idb }));

import { syncOdevzdavarny } from '../syncOdevzdavarny';

const row = (name: string, obdobi: string) => ({ name, obdobi, courseId: '1' });

/** One period's answer, the way fetchOdevzdavarny returns it. */
const page = (obdobi: string, names: string[], periods = ['801', '812', '829']) => ({
  assignments: names.map((n) => row(n, obdobi)),
  lastFetched: 1,
  periods,
});

describe('syncOdevzdavarny', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idb.get.mockResolvedValue(undefined);
  });

  it('stores an empty list — IS listing no boxes must clear the old ones', async () => {
    fetchOdevzdavarny.mockImplementation(async (_s: string, o: string) => page(o, []));
    await syncOdevzdavarny('st', '829');
    expect(idb.set).toHaveBeenCalledWith('odevzdavarny', 'st_829', []);
  });

  it('stores nothing when the read failed', async () => {
    fetchOdevzdavarny.mockResolvedValue(null);
    expect(await syncOdevzdavarny('st', '829')).toBeNull();
    expect(idb.set).not.toHaveBeenCalled();
  });

  /**
   * When the semester turns, `obdobi` moves on while the last period's exam
   * boxes are still open — they live in that period, not the new one. So the
   * period before the current one is read too.
   */
  it('adds the previous period’s boxes after the current ones', async () => {
    fetchOdevzdavarny.mockImplementation(async (_s: string, o: string) =>
      page(o, o === '829' ? ['Projekt'] : ['Zkouška 12. 9.'])
    );
    const result = await syncOdevzdavarny('st', '829');
    expect(fetchOdevzdavarny).toHaveBeenCalledWith('st', '812');
    expect(result!.assignments.map((a) => a.name)).toEqual(['Projekt', 'Zkouška 12. 9.']);
    expect(idb.set).toHaveBeenCalledWith('odevzdavarny', 'st_829', result!.assignments);
  });

  it('reads no previous period in a student’s first one', async () => {
    fetchOdevzdavarny.mockResolvedValue(page('829', ['Projekt'], ['829']));
    const result = await syncOdevzdavarny('st', '829');
    expect(fetchOdevzdavarny).toHaveBeenCalledTimes(1);
    expect(result!.assignments).toHaveLength(1);
  });

  it('keeps the cached previous-period boxes when only that read failed', async () => {
    idb.get.mockResolvedValue([row('stale current', '829'), row('Zkouška 12. 9.', '812')]);
    fetchOdevzdavarny.mockImplementation(async (_s: string, o: string) =>
      o === '829' ? page('829', ['Projekt']) : null
    );
    const result = await syncOdevzdavarny('st', '829');
    expect(result!.assignments.map((a) => a.name)).toEqual(['Projekt', 'Zkouška 12. 9.']);
  });

  it('answers null when the current period failed, even if the previous one worked', async () => {
    fetchOdevzdavarny.mockImplementation(async (_s: string, o: string) =>
      o === '829' ? null : page('812', ['Zkouška'])
    );
    expect(await syncOdevzdavarny('st', '829')).toBeNull();
    expect(idb.set).not.toHaveBeenCalled();
  });
});
