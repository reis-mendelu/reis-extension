import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  studyPage,
  INTERRUPTED,
  CONCURRENT,
  type FixtureStudy,
} from '../userParams/__tests__/studyPage.fixture';

/**
 * getUserParams end to end over the two reported students' pages — the real
 * fetchers and the real study resolution, with only the network and the
 * database faked. Statuses other than "řádně zapsán" are SYNTHETIC (see
 * studyPage.fixture.ts).
 */
const { idb, fetchWithAuth } = vi.hoisted(() => ({
  idb: new Map<string, unknown>(),
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
    clearAll: vi.fn(async () => idb.clear()),
  },
}));
vi.mock('../../api/client', () => ({
  fetchWithAuth: (...a: unknown[]) => fetchWithAuth(...a),
  BASE_URL: 'https://is.mendelu.cz',
}));

const { getUserParams, clearUserParamsCache, selectStudy } = await import('../userParams');
const { onIdentityChange } = await import('../userParams/identityEvents');
const { IndexedDBService } = await import('../../services/storage');

/**
 * IS: `studium.pl` with no study is about whichever study IS defaults to;
 * with one, about that study. moje_studium.pl carries the same header.
 */
function serveIs(studies: FixtureStudy[], isDefault: string, status: Record<string, string>) {
  fetchWithAuth.mockImplementation((url: string) => {
    const id = /studium=(\d+)/.exec(url)?.[1];
    const page =
      url.includes('studium.pl') || url.includes('moje_studium.pl')
        ? studyPage({ studies, selected: id ?? isDefault, status: status[id ?? isDefault] ?? '' })
        : '';
    return Promise.resolve({ text: () => Promise.resolve(page) });
  });
}

const announced = vi.fn();
onIdentityChange(announced);

describe('getUserParams over the reported pages', () => {
  beforeEach(() => {
    clearUserParamsCache();
    idb.clear();
    announced.mockReset();
    vi.mocked(IndexedDBService.clearAll).mockClear();
  });

  // Supabase suggestion 2026-10-07 / email 2026-10-16: an install already on
  // the interrupted FRRMS study, while IS also defaults to it.
  it('moves an install off an interrupted study onto the current one', async () => {
    idb.set('reis_user_params', {
      studium: '900003',
      obdobi: '815',
      studentId: '100001',
      fullName: '',
      studyCode: 'všechna období',
      isErasmus: false,
    });
    serveIs(INTERRUPTED, '900003', {
      '900001': 'řádně zapsán',
      '900002': 'studium ukončeno',
      '900003': 'studium přerušeno',
    });

    const params = await getUserParams();

    expect(params).toMatchObject({
      studium: '900001',
      obdobi: '829',
      studyCode: 'PEF B-EM prez [sem 1, roč 1]',
      facultyLabel: 'PEF',
      studyProgram: 'B-EM',
      studentId: '100001',
    });
    // One active study: nothing to switch to.
    expect(params?.studies).toBeUndefined();
    expect(idb.get('reis_user_params')).toEqual(params);
    expect(IndexedDBService.clearAll).not.toHaveBeenCalled();
    expect(announced).not.toHaveBeenCalled();
  });

  // Suggestion 2026-10-02: two active studies, first install.
  it('offers both concurrent studies and takes the first IS lists', async () => {
    serveIs(CONCURRENT, '900011', { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    const params = await getUserParams();
    expect(params?.studium).toBe('900011');
    expect(params?.studyProgram).toBe('B-AII');
    expect(params?.studies?.map((s) => s.studium)).toEqual(['900011', '900012']);
  });

  /**
   * Starts, not one start. The fixtures greet "Přihlášena:" as the real
   * pages do, and the name regex does not read that yet, so these records
   * are incomplete and rebuild on every start — the path that, with the
   * daily resolution cache, used to write IS's default study back on every
   * second start.
   */
  it('stays on the current study across starts (interrupted-study student)', async () => {
    serveIs(INTERRUPTED, '900003', {
      '900001': 'řádně zapsán',
      '900002': 'studium ukončeno',
      '900003': 'studium přerušeno',
    });
    for (let start = 1; start <= 3; start++) {
      clearUserParamsCache();
      expect((await getUserParams())?.studium, `start ${start}`).toBe('900001');
    }
  });

  it("keeps the concurrent-study student's choice across starts", async () => {
    serveIs(CONCURRENT, '900011', { '900011': 'řádně zapsán', '900012': 'řádně zapsán' });
    await getUserParams();
    await selectStudy('900012');
    for (let start = 1; start <= 3; start++) {
      clearUserParamsCache();
      const params = await getUserParams();
      expect(params?.studium, `start ${start}`).toBe('900012');
      expect(params?.studyProgram).toBe('B-EM');
      expect(params?.studies).toHaveLength(2);
    }
  });
});
