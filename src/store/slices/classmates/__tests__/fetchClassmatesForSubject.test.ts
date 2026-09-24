import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../../utils/reportError', () => ({
  logError: vi.fn(),
}));

vi.mock('../../../../api/classmates', () => ({
  fetchSeminarGroupIds: vi.fn(),
  fetchClassmates: vi.fn(),
}));

vi.mock('../../../../utils/userParams', () => ({
  getUserParams: vi.fn(),
}));

import {
  fetchAndPersistClassmates,
  persistClassmatesNoSeminar,
  CLASSMATES_NO_SEMINAR_KEY,
} from '../fetchClassmatesForSubject';
import { IndexedDBService } from '../../../../services/storage';
import { fetchSeminarGroupIds, fetchClassmates } from '../../../../api/classmates';
import { getUserParams } from '../../../../utils/userParams';
import type { SubjectsData } from '../../../../types/documents';

const subjects = { data: { 'EBC-MNG': { subjectId: '160001' } } } as unknown as SubjectsData;

describe('fetchAndPersistClassmates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserParams).mockResolvedValue({ studium: '149707', obdobi: '829' } as never);
  });

  /**
   * A lecture-only subject has no seminar group, so the IS overview carries no
   * skupina= link for it. That is NOT "nobody enrolled": the caller needs to
   * know the list is empty because there is no cvičení to take it from.
   */
  it('flags a subject with no seminar group as noSeminar and stores []', async () => {
    vi.mocked(fetchSeminarGroupIds).mockResolvedValueOnce({});

    const result = await fetchAndPersistClassmates({ courseCode: 'EBC-MNG', subjects });

    expect(result).toEqual({ data: [], fetchedAt: expect.any(Number), noSeminar: true });
    expect(fetchClassmates).not.toHaveBeenCalled();
    expect(IndexedDBService.set).toHaveBeenCalledWith('classmates', 'EBC-MNG', []);
  });

  it('reports noSeminar: false when the roster comes from a seminar group', async () => {
    const roster = [{ personId: 1, name: 'A', photoUrl: 'p', studyInfo: 's' }];
    vi.mocked(fetchSeminarGroupIds).mockResolvedValueOnce({ '160001': '178894' });
    vi.mocked(fetchClassmates).mockResolvedValueOnce(roster);

    const result = await fetchAndPersistClassmates({ courseCode: 'EBC-MNG', subjects });

    expect(result).toEqual({ data: roster, fetchedAt: expect.any(Number), noSeminar: false });
    expect(fetchClassmates).toHaveBeenCalledWith('160001', '149707', '829', '178894');
  });
});

describe('persistClassmatesNoSeminar', () => {
  it('writes the map to the meta store', async () => {
    await persistClassmatesNoSeminar({ 'EBC-MNG': true });
    expect(IndexedDBService.set).toHaveBeenCalledWith('meta', CLASSMATES_NO_SEMINAR_KEY, {
      'EBC-MNG': true,
    });
  });
});
