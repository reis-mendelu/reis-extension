/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSyllabusSlice } from '../createSyllabusSlice';
import { IndexedDBService } from '../../../services/storage';
import { fetchSyllabus, findSubjectId } from '../../../api/syllabus';
import type { SyllabusSlice } from '../../types';
import type { SyllabusRequirements } from '../../../types/documents';
import { SYLLABUS_VERSION } from '../../../utils/parsers/syllabusParser';

vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../api/syllabus', () => ({
  fetchSyllabus: vi.fn(),
  findSubjectId: vi.fn(),
}));

describe('SyllabusSlice', () => {
  let set: Mock;
  let get: Mock;
  let slice: SyllabusSlice & { language: string };

  beforeEach(() => {
    vi.clearAllMocks();
    set = vi.fn((fn) => {
      const state = fn({ syllabuses: slice.syllabuses });
      Object.assign(slice, state);
    });
    get = vi.fn(() => slice);
    slice = {
      language: 'cz',
      ...createSyllabusSlice(set as any, get as any, {} as any),
    } as SyllabusSlice & { language: string };
  });

  // A legacy v3 record whose refresh cannot resolve an id: syncSyllabus returns
  // undefined (syncSyllabus.ts:52), the slice keeps the stale record in
  // `activeSyllabus` and writes it to the in-memory cache. If the fast-path
  // guard checked only `language`, that stale record would then be served for
  // the rest of the session and the version-4 check skipped entirely — the
  // refetch this version bump exists to force would never be retried.
  it('retries a stale-version record instead of serving it from the fast path', async () => {
    const stale = {
      version: 3,
      language: 'cz',
      requirementsText: 'stale v3',
      requirementsTable: [],
    } as unknown as SyllabusRequirements;

    vi.mocked(IndexedDBService.get).mockResolvedValue(stale);
    // No id resolvable -> fetchAndCacheSingleSyllabus returns undefined.
    vi.mocked(findSubjectId).mockResolvedValue(null);

    await slice.fetchSyllabus('EBC-PS');
    // The stale record is still shown rather than blanking the tab...
    expect(slice.syllabuses.cache['EBC-PS']).toEqual(stale);

    // ...but a second call must NOT short-circuit on it: the version differs,
    // so the refresh is attempted again.
    vi.mocked(findSubjectId).mockClear();
    await slice.fetchSyllabus('EBC-PS');
    expect(findSubjectId).toHaveBeenCalled();
  });

  it('still short-circuits on a current-version cached record', async () => {
    const fresh = {
      version: 4,
      language: 'cz',
      requirementsText: 'fresh v4',
      requirementsTable: [],
    } as unknown as SyllabusRequirements;

    vi.mocked(IndexedDBService.get).mockResolvedValue(fresh);
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    await slice.fetchSyllabus('EBC-PS');

    vi.mocked(findSubjectId).mockClear();
    vi.mocked(IndexedDBService.get).mockClear();
    await slice.fetchSyllabus('EBC-PS');
    expect(findSubjectId).not.toHaveBeenCalled();
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('should fetch from API if not in cache or DB', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue(null);
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
    } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'cz');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
    });
    expect(IndexedDBService.set).toHaveBeenCalled();
  });

  // `version` added to the fixture, not the assertion relaxed: the fast path now
  // requires the cached record to be BOTH the right language and the current
  // version, so a versionless record is no longer a valid cache hit.
  it('should use cache if language and version match', async () => {
    slice.syllabuses.cache['EBC-ALG'] = {
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
      version: SYLLABUS_VERSION,
    };

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).not.toHaveBeenCalled();
    expect(IndexedDBService.get).not.toHaveBeenCalled();
  });

  it('should re-fetch if cache language mismatches', async () => {
    slice.syllabuses.cache['EBC-ALG'] = {
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
    };
    slice.language = 'en'; // Switch language

    vi.mocked(IndexedDBService.get).mockResolvedValue({
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
    });
    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({
      requirementsText: 'EN Syllabus',
      requirementsTable: [],
      language: 'en',
    } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'en');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({
      requirementsText: 'EN Syllabus',
      requirementsTable: [],
      language: 'en',
    });
  });

  it('should re-fetch if DB language mismatches', async () => {
    vi.mocked(IndexedDBService.get).mockResolvedValue({
      requirementsText: 'CZ Syllabus',
      requirementsTable: [],
      language: 'cz',
    });
    slice.language = 'en';

    vi.mocked(findSubjectId).mockResolvedValue('12345');
    vi.mocked(fetchSyllabus).mockResolvedValue({
      requirementsText: 'EN Syllabus',
      requirementsTable: [],
      language: 'en',
    } as SyllabusRequirements);

    await slice.fetchSyllabus('EBC-ALG');

    expect(fetchSyllabus).toHaveBeenCalledWith('12345', 'en');
    expect(slice.syllabuses.cache['EBC-ALG']).toEqual({
      requirementsText: 'EN Syllabus',
      requirementsTable: [],
      language: 'en',
    });
  });
});
