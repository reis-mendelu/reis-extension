import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadFollowedList, STORAGE_KEY, CHOSEN_KEY } from '../follows/loadFollows';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

const mockGetUserParams = vi.fn();
const mockIDBGet = vi.fn();
const mockIDBSet = vi.fn();

vi.mock('../../../utils/userParams', () => ({
  getUserParams: (...args: unknown[]) => mockGetUserParams(...args),
}));

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: (...args: unknown[]) => mockIDBGet(...args),
    set: (...args: unknown[]) => mockIDBSet(...args),
  },
}));

vi.mock('../../../utils/reportError', () => ({ logError: vi.fn() }));

const ERASMUS_AUTO_KEY = 'reis_erasmus_auto_subscribed';

function makeUser(facultyLabel: string | null, isErasmus: boolean) {
  return {
    studium: 's',
    obdobi: 'o',
    facultyId: '',
    facultyLabel: facultyLabel ?? '',
    username: 'u',
    studentId: 'id',
    fullName: 'Test',
    isErasmus,
  };
}

/** IndexedDB holding exactly these `meta` keys. */
function disk(values: Record<string, unknown>) {
  mockIDBGet.mockImplementation((store: string, key: string) =>
    Promise.resolve(store === 'meta' ? values[key] : undefined)
  );
}

const load = () => loadFollowedList(BUNDLED_SOCIETIES);
const writesOf = (key: string) => mockIDBSet.mock.calls.filter((c) => c[1] === key);

// Moved here with the logic from useSpolkySettings' own test, which now covers
// only reading the store. These are the cases the moved comments record as
// hard-won; each one is a real report.
describe('loadFollowedList', () => {
  beforeEach(() => {
    mockGetUserParams.mockReset();
    mockIDBGet.mockReset();
    mockIDBSet.mockReset().mockResolvedValue(undefined);
  });

  describe('returning Erasmus student — legacy ESN back-fill', () => {
    it('back-fills ESN when the flag is not set and ESN is missing', async () => {
      disk({ [STORAGE_KEY]: ['ldf'] });
      mockGetUserParams.mockResolvedValue(makeUser('LDF', true));
      await expect(load()).resolves.toEqual(['ldf', 'esn']);
      expect(writesOf(ERASMUS_AUTO_KEY)).toHaveLength(1);
    });

    it('does not back-fill ESN once the flag is set', async () => {
      disk({ [STORAGE_KEY]: ['ldf'], [ERASMUS_AUTO_KEY]: true });
      mockGetUserParams.mockResolvedValue(makeUser('LDF', true));
      await expect(load()).resolves.toEqual(['ldf']);
    });

    it('does not back-fill ESN when it is already there', async () => {
      disk({ [STORAGE_KEY]: ['ldf', 'esn'] });
      mockGetUserParams.mockResolvedValue(makeUser('LDF', true));
      await expect(load()).resolves.toEqual(['ldf', 'esn']);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
    });
  });

  describe('renamed society ids', () => {
    // Reported by review on #333: awaiting the write before hydrating left a
    // student with a good saved list subscribed to nothing for the session.
    it('still returns the migrated list when persisting it fails', async () => {
      disk({ [STORAGE_KEY]: ['af', 'esn'] });
      mockIDBSet.mockRejectedValue(new Error('QuotaExceededError'));
      mockGetUserParams.mockResolvedValue(makeUser('AF', false));
      await expect(load()).resolves.toEqual(['usaf', 'esn']);
    });

    it('does not write when no saved id was renamed', async () => {
      disk({ [STORAGE_KEY]: ['ldf', 'esn'] });
      mockGetUserParams.mockResolvedValue(makeUser('LDF', false));
      await expect(load()).resolves.toEqual(['ldf', 'esn']);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
    });
  });

  describe('a closed write guard', () => {
    const closed = () => loadFollowedList(BUNDLED_SOCIETIES, () => false);

    it('writes no faculty default and no chosen mark, but still returns the default', async () => {
      disk({ [STORAGE_KEY]: [] });
      mockGetUserParams.mockResolvedValue(makeUser('PEF', false));
      await expect(closed()).resolves.toEqual(['supef']);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
      expect(writesOf(CHOSEN_KEY)).toHaveLength(0);
    });

    it('an Erasmus default writes no ESN flag either, so a later boot can still add it', async () => {
      disk({});
      mockGetUserParams.mockResolvedValue(makeUser('PEF', true));
      await expect(closed()).resolves.toEqual(['esn']);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
      expect(writesOf(ERASMUS_AUTO_KEY)).toHaveLength(0);
    });

    it('writes no migrated list', async () => {
      disk({ [STORAGE_KEY]: ['af'] });
      mockGetUserParams.mockResolvedValue(makeUser('AF', false));
      await expect(closed()).resolves.toEqual(['usaf']);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
    });

    it('skips the ESN back-fill whole, flag included, so a later boot can still add it', async () => {
      disk({ [STORAGE_KEY]: ['ldf'] });
      mockGetUserParams.mockResolvedValue(makeUser('LDF', true));
      await closed();
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
      expect(writesOf(ERASMUS_AUTO_KEY)).toHaveLength(0);
    });
  });

  describe('an unresolved faculty', () => {
    it('an unmapped faculty gives an empty list and saves nothing', async () => {
      disk({});
      mockGetUserParams.mockResolvedValue(makeUser('99', false));
      await expect(load()).resolves.toEqual([]);
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
    });

    it('an unparsed faculty saves no empty default, so the next boot can resolve it', async () => {
      disk({});
      mockGetUserParams.mockResolvedValue(makeUser(null, false));
      await load();
      expect(writesOf(STORAGE_KEY)).toHaveLength(0);
    });

    it('returns null while IS cannot say who is signed in', async () => {
      disk({});
      mockGetUserParams.mockResolvedValue(null);
      await expect(load()).resolves.toBeNull();
    });

    // cubic on #475: marking CHOSEN_KEY after a lookup that resolved nothing
    // turned a failed lookup into a settled choice, and the legacy `[]` was
    // then never re-resolved again.
    it('does not mark a legacy empty list chosen when the faculty still does not resolve', async () => {
      disk({ [STORAGE_KEY]: [] });
      mockGetUserParams.mockResolvedValue(makeUser(null, false));
      await expect(load()).resolves.toEqual([]);
      expect(writesOf(CHOSEN_KEY)).toHaveLength(0);
    });

    it('marks a legacy empty list chosen once it has resolved to a default', async () => {
      disk({ [STORAGE_KEY]: [] });
      mockGetUserParams.mockResolvedValue(makeUser('PEF', false));
      await expect(load()).resolves.toEqual(['supef']);
      expect(writesOf(CHOSEN_KEY)).toEqual([['meta', CHOSEN_KEY, true]]);
    });
  });
});
