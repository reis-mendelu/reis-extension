import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn() },
}));

vi.mock('../../../../api/classmates', () => ({
  fetchSubjectClassmates: vi.fn(),
}));

vi.mock('../../../../utils/userParams', () => ({
  getUserParams: vi.fn(),
}));

import {
  fetchAndPersistSubjectClassmates,
  loadCachedSubjectClassmates,
  subjectClassmatesKey,
  subjectClassmatesFetchedKey,
} from '../subjectClassmatesCache';
import { IndexedDBService } from '../../../../services/storage';
import { fetchSubjectClassmates } from '../../../../api/classmates';
import { getUserParams } from '../../../../utils/userParams';
import type { SubjectsData } from '../../../../types/documents';

const subjects = { data: { MNG: { subjectId: '164226' } } } as unknown as SubjectsData;
const ROSTER = [{ personId: 1, name: 'Nováková Tereza', photoUrl: 'p', studyInfo: 's' }];

describe('subjectClassmatesCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserParams).mockResolvedValue({ studium: '222222', obdobi: '333' } as never);
  });

  it('keeps the whole-subject list apart from the seminar list in the classmates store', () => {
    expect(subjectClassmatesKey('MNG')).toBe('subject:MNG');
    expect(subjectClassmatesKey('MNG')).not.toBe('MNG');
  });

  it('fetches by the subject id and caches the list with its fetch time', async () => {
    vi.mocked(fetchSubjectClassmates).mockResolvedValue(ROSTER);

    const result = await fetchAndPersistSubjectClassmates({ courseCode: 'MNG', subjects });

    expect(fetchSubjectClassmates).toHaveBeenCalledWith('164226', '222222', '333');
    expect(IndexedDBService.set).toHaveBeenCalledWith('classmates', 'subject:MNG', ROSTER);
    expect(IndexedDBService.set).toHaveBeenCalledWith(
      'meta',
      subjectClassmatesFetchedKey('MNG'),
      result!.fetchedAt
    );
    expect(result!.data).toEqual(ROSTER);
  });

  it('returns null without a subject id or a study — nothing to ask IS for', async () => {
    expect(
      await fetchAndPersistSubjectClassmates({
        courseCode: 'MNG',
        subjects: { data: { MNG: {} } } as unknown as SubjectsData,
      })
    ).toBeNull();
    vi.mocked(getUserParams).mockResolvedValue(null as never);
    expect(await fetchAndPersistSubjectClassmates({ courseCode: 'MNG', subjects })).toBeNull();
    expect(fetchSubjectClassmates).not.toHaveBeenCalled();
  });

  it('reads the cached list back with its fetch time', async () => {
    vi.mocked(IndexedDBService.get).mockImplementation(async (store, key) =>
      store === 'classmates' && key === 'subject:MNG' ? ROSTER : 1234
    );
    expect(await loadCachedSubjectClassmates('MNG')).toEqual({ data: ROSTER, fetchedAt: 1234 });
  });

  it('treats a list without a fetch time as stale, not fresh', async () => {
    vi.mocked(IndexedDBService.get).mockImplementation(async (store) =>
      store === 'classmates' ? ROSTER : undefined
    );
    expect(await loadCachedSubjectClassmates('MNG')).toEqual({ data: ROSTER, fetchedAt: 0 });
  });

  it('has nothing cached when the store has no list', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(undefined);
    expect(await loadCachedSubjectClassmates('MNG')).toBeNull();
  });
});
